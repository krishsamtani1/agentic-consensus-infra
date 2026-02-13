/**
 * TRUTH-NET Rating API Routes
 * 
 * Public-facing API for consuming agent ratings.
 * This is the primary product of the platform — enterprises and developers
 * query these endpoints to evaluate AI trading agents.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RatingEngine, RatingGrade, computeGrade, gradeToColor } from '../../rating/RatingEngine.js';
import { EventBus } from '../../events/EventBus.js';

export function createRatingRoutes(ratingEngine: RatingEngine, eventBus: EventBus) {
  return async function ratingRoutes(fastify: FastifyInstance): Promise<void> {

    // -----------------------------------------------------------------------
    // GET /ratings/leaderboard - Global agent leaderboard
    // -----------------------------------------------------------------------
    fastify.get('/ratings/leaderboard', async (
      request: FastifyRequest<{ Querystring: { limit?: string; include_unrated?: string } }>,
      reply: FastifyReply
    ) => {
      const limit = parseInt(request.query.limit || '20');
      const includeUnrated = request.query.include_unrated === 'true';

      const leaderboard = includeUnrated
        ? ratingEngine.getFullLeaderboard(limit)
        : ratingEngine.getLeaderboard(limit);

      return reply.send({
        success: true,
        data: {
          leaderboard: leaderboard.map((r, index) => ({
            rank: index + 1,
            agent_id: r.agent_id,
            truth_score: Math.round(r.truth_score * 10) / 10,
            grade: r.grade,
            grade_color: gradeToColor(r.grade),
            certified: r.certified,
            brier_score: r.brier_score,
            sharpe_ratio: Math.round(r.sharpe_ratio * 100) / 100,
            win_rate: Math.round(r.win_rate * 1000) / 10, // percentage with 1 decimal
            max_drawdown: Math.round(r.max_drawdown * 1000) / 10,
            total_trades: r.total_trades,
            total_pnl: Math.round(r.total_pnl * 100) / 100,
          })),
          total: leaderboard.length,
          distribution: ratingEngine.getDistribution(),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /ratings/:agentId - Detailed rating for a specific agent
    // -----------------------------------------------------------------------
    fastify.get('/ratings/:agentId', async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const { agentId } = request.params;
      const rating = ratingEngine.getRating(agentId);

      if (!rating) {
        return reply.status(404).send({
          success: false,
          error: { code: 'AGENT_NOT_FOUND', message: `No rating found for agent ${agentId}` },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          agent_id: rating.agent_id,
          truth_score: Math.round(rating.truth_score * 10) / 10,
          grade: rating.grade,
          grade_color: gradeToColor(rating.grade),
          certified: rating.certified,
          certified_at: rating.certified_at?.toISOString(),

          // Component breakdown
          components: {
            brier: { score: rating.brier_component, weight: 0.35, raw: rating.brier_score },
            sharpe: { score: rating.sharpe_component, weight: 0.25, raw: rating.sharpe_ratio },
            win_rate: { score: rating.winrate_component, weight: 0.20, raw: rating.win_rate },
            consistency: { score: rating.consistency_component, weight: 0.10 },
            risk: { score: rating.risk_component, weight: 0.10, raw_drawdown: rating.max_drawdown },
          },

          // Performance stats
          performance: {
            total_trades: rating.total_trades,
            winning_trades: rating.winning_trades,
            win_rate: Math.round(rating.win_rate * 1000) / 10,
            total_pnl: Math.round(rating.total_pnl * 100) / 100,
            sharpe_ratio: Math.round(rating.sharpe_ratio * 100) / 100,
            max_drawdown: Math.round(rating.max_drawdown * 1000) / 10,
            brier_score: rating.brier_score,
          },

          last_updated: rating.last_updated.toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /ratings/:agentId/history - Historical rating over time
    // -----------------------------------------------------------------------
    fastify.get('/ratings/:agentId/history', async (
      request: FastifyRequest<{ Params: { agentId: string }; Querystring: { days?: string } }>,
      reply: FastifyReply
    ) => {
      const { agentId } = request.params;
      const days = parseInt(request.query.days || '30');
      const rating = ratingEngine.getRating(agentId);

      if (!rating) {
        return reply.status(404).send({
          success: false,
          error: { code: 'AGENT_NOT_FOUND', message: `No rating found for agent ${agentId}` },
          timestamp: new Date().toISOString(),
        });
      }

      const history = rating.score_history.slice(-days);
      const snapshots = ratingEngine.getSnapshots(agentId);

      return reply.send({
        success: true,
        data: {
          agent_id: agentId,
          current_grade: rating.grade,
          current_score: Math.round(rating.truth_score * 10) / 10,
          history,
          grade_changes: snapshots.map(s => ({
            date: s.created_at.toISOString(),
            from: s.previous_grade,
            to: s.grade,
            change: s.grade_change,
            score: Math.round(s.truth_score * 10) / 10,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /ratings/certifications - List all certified agents
    // -----------------------------------------------------------------------
    fastify.get('/ratings/certifications', async (
      _request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const certified = ratingEngine.getCertifiedAgents();

      return reply.send({
        success: true,
        data: {
          certified_agents: certified.map(r => ({
            agent_id: r.agent_id,
            grade: r.grade,
            truth_score: Math.round(r.truth_score * 10) / 10,
            certified_at: r.certified_at?.toISOString(),
            total_trades: r.total_trades,
          })),
          total: certified.length,
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // POST /ratings/:agentId/certify - Request certification for an agent
    // -----------------------------------------------------------------------
    fastify.post('/ratings/:agentId/certify', async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const { agentId } = request.params;
      const cert = ratingEngine.certifyAgent(agentId);

      if (!cert) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'CERTIFICATION_FAILED',
            message: 'Agent does not meet minimum requirements for certification (50+ trades, grade B or above)',
          },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          certification_id: cert.id,
          agent_id: cert.agent_id,
          grade: cert.grade,
          truth_score: Math.round(cert.truth_score * 10) / 10,
          issued_at: cert.issued_at.toISOString(),
          expires_at: cert.expires_at.toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /ratings/compare - Side-by-side agent comparison
    // -----------------------------------------------------------------------
    fastify.get('/ratings/compare', async (
      request: FastifyRequest<{ Querystring: { agents: string } }>,
      reply: FastifyReply
    ) => {
      const agentIds = (request.query.agents || '').split(',').filter(Boolean);

      if (agentIds.length < 2) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Provide at least 2 agent IDs separated by commas' },
          timestamp: new Date().toISOString(),
        });
      }

      const ratings = ratingEngine.compareAgents(agentIds);

      return reply.send({
        success: true,
        data: {
          comparison: ratings.map(r => ({
            agent_id: r.agent_id,
            truth_score: Math.round(r.truth_score * 10) / 10,
            grade: r.grade,
            grade_color: gradeToColor(r.grade),
            brier_score: r.brier_score,
            sharpe_ratio: Math.round(r.sharpe_ratio * 100) / 100,
            win_rate: Math.round(r.win_rate * 1000) / 10,
            max_drawdown: Math.round(r.max_drawdown * 1000) / 10,
            total_trades: r.total_trades,
            total_pnl: Math.round(r.total_pnl * 100) / 100,
            certified: r.certified,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // -----------------------------------------------------------------------
    // GET /ratings/distribution - Rating distribution across all agents
    // -----------------------------------------------------------------------
    fastify.get('/ratings/distribution', async (
      _request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const distribution = ratingEngine.getDistribution();
      const total = Object.values(distribution).reduce((a, b) => a + b, 0);

      return reply.send({
        success: true,
        data: {
          distribution,
          total_agents: total,
          rated_agents: total - (distribution['NR'] || 0),
        },
        timestamp: new Date().toISOString(),
      });
    });
  };
}
