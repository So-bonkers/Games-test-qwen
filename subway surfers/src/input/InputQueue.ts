export type InputAction = 'left' | 'right' | 'jump' | 'slide';

export class InputQueue {
  private readonly queue: InputAction[] = [];

  push(action: InputAction): void {
    this.queue.push(action);
  }

  pushAll(actions: InputAction[]): void {
    for (const a of actions) this.queue.push(a);
  }

  drain(): InputAction[] {
    if (this.queue.length === 0) return [];
    return this.queue.splice(0, this.queue.length);
  }

  get pending(): number {
    return this.queue.length;
  }
}
