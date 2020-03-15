
export interface IFlowInstanceRepository {
    save(flowInstance: FlowInstance);
    load(instanceId: string): FlowInstance;
}

export class FlowInstance {
    constructor(public id: string) { }
}