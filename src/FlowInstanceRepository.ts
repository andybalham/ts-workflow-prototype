import { FlowInstanceStackFrame } from "./FlowContext";

export interface IFlowInstanceRepository {
    // TODO 02Apr20: We would want to save the requestId as well
    save(instanceId: string, stackFrames: FlowInstanceStackFrame[]);
    load(instanceId: string): FlowInstanceStackFrame[];
}
