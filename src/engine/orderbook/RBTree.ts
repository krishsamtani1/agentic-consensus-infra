/**
 * TRUTH-NET Red-Black Tree Implementation
 * O(log n) insertion, deletion, and lookup for price levels
 * 
 * Properties:
 * 1. Every node is either red or black
 * 2. Root is always black
 * 3. No two adjacent red nodes
 * 4. Every path from root to null has same number of black nodes
 */

export enum Color {
  RED = 0,
  BLACK = 1,
}

export class RBNode<K, V> {
  key: K;
  value: V;
  left: RBNode<K, V> | null = null;
  right: RBNode<K, V> | null = null;
  parent: RBNode<K, V> | null = null;
  color: Color = Color.RED;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}

export type Comparator<K> = (a: K, b: K) => number;

/**
 * High-performance Red-Black Tree
 * Used for maintaining sorted price levels in the order book
 */
export class RBTree<K, V> {
  private root: RBNode<K, V> | null = null;
  private _size: number = 0;
  private compare: Comparator<K>;

  constructor(comparator: Comparator<K>) {
    this.compare = comparator;
  }

  get size(): number {
    return this._size;
  }

  get isEmpty(): boolean {
    return this._size === 0;
  }

  // =========================================================================
  // PUBLIC OPERATIONS
  // =========================================================================

  /**
   * Insert key-value pair - O(log n)
   */
  insert(key: K, value: V): void {
    const node = new RBNode(key, value);

    if (!this.root) {
      this.root = node;
      node.color = Color.BLACK;
      this._size++;
      return;
    }

    // Standard BST insert
    let current = this.root;
    let parent: RBNode<K, V> | null = null;

    while (current) {
      parent = current;
      const cmp = this.compare(key, current.key);

      if (cmp < 0) {
        current = current.left;
      } else if (cmp > 0) {
        current = current.right;
      } else {
        // Key exists, update value
        current.value = value;
        return;
      }
    }

    node.parent = parent;
    if (this.compare(key, parent!.key) < 0) {
      parent!.left = node;
    } else {
      parent!.right = node;
    }

    this._size++;
    this.fixInsert(node);
  }

  /**
   * Delete by key - O(log n)
   */
  delete(key: K): boolean {
    const node = this.findNode(key);
    if (!node) return false;

    this.deleteNode(node);
    this._size--;
    return true;
  }

  /**
   * Find value by key - O(log n)
   */
  find(key: K): V | undefined {
    const node = this.findNode(key);
    return node?.value;
  }

  /**
   * Check if key exists - O(log n)
   */
  has(key: K): boolean {
    return this.findNode(key) !== null;
  }

  /**
   * Get minimum key - O(log n)
   */
  min(): { key: K; value: V } | undefined {
    if (!this.root) return undefined;
    const node = this.minimum(this.root);
    return { key: node.key, value: node.value };
  }

  /**
   * Get maximum key - O(log n)
   */
  max(): { key: K; value: V } | undefined {
    if (!this.root) return undefined;
    const node = this.maximum(this.root);
    return { key: node.key, value: node.value };
  }

  /**
   * In-order traversal (ascending) - O(n)
   */
  *inOrder(): Generator<{ key: K; value: V }> {
    yield* this.inOrderTraversal(this.root);
  }

  /**
   * Reverse in-order traversal (descending) - O(n)
   */
  *reverseOrder(): Generator<{ key: K; value: V }> {
    yield* this.reverseOrderTraversal(this.root);
  }

  /**
   * Get entries as array (ascending) - O(n)
   */
  toArray(): Array<{ key: K; value: V }> {
    return Array.from(this.inOrder());
  }

  /**
   * Clear the tree - O(1)
   */
  clear(): void {
    this.root = null;
    this._size = 0;
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private findNode(key: K): RBNode<K, V> | null {
    let current = this.root;

    while (current) {
      const cmp = this.compare(key, current.key);
      if (cmp < 0) {
        current = current.left;
      } else if (cmp > 0) {
        current = current.right;
      } else {
        return current;
      }
    }

    return null;
  }

  private minimum(node: RBNode<K, V>): RBNode<K, V> {
    while (node.left) {
      node = node.left;
    }
    return node;
  }

  private maximum(node: RBNode<K, V>): RBNode<K, V> {
    while (node.right) {
      node = node.right;
    }
    return node;
  }

  // =========================================================================
  // ROTATIONS
  // =========================================================================

  private rotateLeft(node: RBNode<K, V>): void {
    const right = node.right!;
    node.right = right.left;

    if (right.left) {
      right.left.parent = node;
    }

    right.parent = node.parent;

    if (!node.parent) {
      this.root = right;
    } else if (node === node.parent.left) {
      node.parent.left = right;
    } else {
      node.parent.right = right;
    }

    right.left = node;
    node.parent = right;
  }

  private rotateRight(node: RBNode<K, V>): void {
    const left = node.left!;
    node.left = left.right;

    if (left.right) {
      left.right.parent = node;
    }

    left.parent = node.parent;

    if (!node.parent) {
      this.root = left;
    } else if (node === node.parent.right) {
      node.parent.right = left;
    } else {
      node.parent.left = left;
    }

    left.right = node;
    node.parent = left;
  }

  // =========================================================================
  // FIX-UP OPERATIONS
  // =========================================================================

  private fixInsert(node: RBNode<K, V>): void {
    while (node.parent && node.parent.color === Color.RED) {
      if (node.parent === node.parent.parent?.left) {
        const uncle = node.parent.parent.right;

        if (uncle && uncle.color === Color.RED) {
          // Case 1: Uncle is red
          node.parent.color = Color.BLACK;
          uncle.color = Color.BLACK;
          node.parent.parent.color = Color.RED;
          node = node.parent.parent;
        } else {
          if (node === node.parent.right) {
            // Case 2: Node is right child
            node = node.parent;
            this.rotateLeft(node);
          }
          // Case 3: Node is left child
          node.parent!.color = Color.BLACK;
          node.parent!.parent!.color = Color.RED;
          this.rotateRight(node.parent!.parent!);
        }
      } else {
        const uncle = node.parent.parent?.left;

        if (uncle && uncle.color === Color.RED) {
          node.parent.color = Color.BLACK;
          uncle.color = Color.BLACK;
          node.parent.parent!.color = Color.RED;
          node = node.parent.parent!;
        } else {
          if (node === node.parent.left) {
            node = node.parent;
            this.rotateRight(node);
          }
          node.parent!.color = Color.BLACK;
          node.parent!.parent!.color = Color.RED;
          this.rotateLeft(node.parent!.parent!);
        }
      }
    }

    this.root!.color = Color.BLACK;
  }

  private deleteNode(node: RBNode<K, V>): void {
    let y = node;
    let yOriginalColor = y.color;
    let x: RBNode<K, V> | null;
    let xParent: RBNode<K, V> | null = null;

    if (!node.left) {
      x = node.right;
      xParent = node.parent;
      this.transplant(node, node.right);
    } else if (!node.right) {
      x = node.left;
      xParent = node.parent;
      this.transplant(node, node.left);
    } else {
      y = this.minimum(node.right);
      yOriginalColor = y.color;
      x = y.right;

      if (y.parent === node) {
        xParent = y;
      } else {
        xParent = y.parent;
        this.transplant(y, y.right);
        y.right = node.right;
        y.right.parent = y;
      }

      this.transplant(node, y);
      y.left = node.left;
      y.left.parent = y;
      y.color = node.color;
    }

    if (yOriginalColor === Color.BLACK) {
      this.fixDelete(x, xParent);
    }
  }

  private transplant(u: RBNode<K, V>, v: RBNode<K, V> | null): void {
    if (!u.parent) {
      this.root = v;
    } else if (u === u.parent.left) {
      u.parent.left = v;
    } else {
      u.parent.right = v;
    }

    if (v) {
      v.parent = u.parent;
    }
  }

  private fixDelete(x: RBNode<K, V> | null, xParent: RBNode<K, V> | null): void {
    while (x !== this.root && (!x || x.color === Color.BLACK)) {
      if (!xParent) break;

      if (x === xParent.left) {
        let w = xParent.right;

        if (w && w.color === Color.RED) {
          w.color = Color.BLACK;
          xParent.color = Color.RED;
          this.rotateLeft(xParent);
          w = xParent.right;
        }

        if (w && (!w.left || w.left.color === Color.BLACK) &&
            (!w.right || w.right.color === Color.BLACK)) {
          w.color = Color.RED;
          x = xParent;
          xParent = x.parent;
        } else if (w) {
          if (!w.right || w.right.color === Color.BLACK) {
            if (w.left) w.left.color = Color.BLACK;
            w.color = Color.RED;
            this.rotateRight(w);
            w = xParent.right;
          }

          if (w) {
            w.color = xParent.color;
            xParent.color = Color.BLACK;
            if (w.right) w.right.color = Color.BLACK;
            this.rotateLeft(xParent);
          }
          x = this.root;
          break;
        }
      } else {
        let w = xParent.left;

        if (w && w.color === Color.RED) {
          w.color = Color.BLACK;
          xParent.color = Color.RED;
          this.rotateRight(xParent);
          w = xParent.left;
        }

        if (w && (!w.right || w.right.color === Color.BLACK) &&
            (!w.left || w.left.color === Color.BLACK)) {
          w.color = Color.RED;
          x = xParent;
          xParent = x.parent;
        } else if (w) {
          if (!w.left || w.left.color === Color.BLACK) {
            if (w.right) w.right.color = Color.BLACK;
            w.color = Color.RED;
            this.rotateLeft(w);
            w = xParent.left;
          }

          if (w) {
            w.color = xParent.color;
            xParent.color = Color.BLACK;
            if (w.left) w.left.color = Color.BLACK;
            this.rotateRight(xParent);
          }
          x = this.root;
          break;
        }
      }
    }

    if (x) x.color = Color.BLACK;
  }

  // =========================================================================
  // TRAVERSALS
  // =========================================================================

  private *inOrderTraversal(node: RBNode<K, V> | null): Generator<{ key: K; value: V }> {
    if (!node) return;
    yield* this.inOrderTraversal(node.left);
    yield { key: node.key, value: node.value };
    yield* this.inOrderTraversal(node.right);
  }

  private *reverseOrderTraversal(node: RBNode<K, V> | null): Generator<{ key: K; value: V }> {
    if (!node) return;
    yield* this.reverseOrderTraversal(node.right);
    yield { key: node.key, value: node.value };
    yield* this.reverseOrderTraversal(node.left);
  }
}
