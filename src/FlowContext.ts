import uuid = require("uuid");
import { FlowHandlers, IFlowHandlers } from "./FlowHandlers";
import { IFlowInstanceRepository } from "./FlowInstanceRepository";

export class FlowContext {

    handlers: IFlowHandlers;

    readonly instanceRespository: IFlowInstanceRepository;
    readonly instanceId: string;
    readonly stackFrames: FlowInstanceStackFrame[];
    asyncRequestId: string;

    readonly resumeStackFrames: FlowInstanceStackFrame[];
    readonly resumeStackFrameCount: number;
    asyncResponse: any;

    constructor(instanceRespository?: IFlowInstanceRepository, instanceId?: string, asyncResponse?: any) {

        this.handlers = new FlowHandlers();
        this.instanceRespository = instanceRespository;
        this.stackFrames = [];

        if (instanceId === undefined) {

            this.instanceId = uuid.v4();

        } else {

            const stackFrames = instanceRespository.retrieve(instanceId);

            this.instanceId = instanceId;
            this.asyncResponse = asyncResponse;
            this.resumeStackFrames = stackFrames.reverse();
            this.resumeStackFrameCount = this.resumeStackFrames.length;
        }
    }

    get currentStackFrame(): FlowInstanceStackFrame {
        return this.stackFrames[this.stackFrames.length - 1];
    }

    get isResume(): boolean {
        return this.asyncResponse !== undefined;
    }

    saveInstance() {
        this.instanceRespository.upsert(this.instanceId, this.stackFrames);
    }

    deleteInstance() {
        this.instanceRespository.delete(this.instanceId);
    }
}

export class FlowInstanceStackFrame {

    readonly flowName: string;
    readonly state: any;
    stepName: string;

    constructor(flowName: string, state: any) {
        this.flowName = flowName;
        this.state = state;
    }
}