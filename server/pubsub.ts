export type PipelineEvent = {
  type: "log" | "start" | "end" | "step-start" | "step-end";
  pipelineId: string;
  payload: any;
};

type Listener = (event: PipelineEvent) => void;

class PubSub {
  private listeners: Listener[] = [];

  subscribe(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  publish(event: PipelineEvent) {
    this.listeners.forEach(l => l(event));
  }
}

export const pubsub = new PubSub();
