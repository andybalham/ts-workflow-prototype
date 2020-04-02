import uuid = require("uuid");
import { FlowHandlers } from "./FlowHandlers";
import { IFlowInstanceRepository } from "./FlowInstanceRepository";

export class FlowContext {

    readonly instanceId: string;
    readonly handlers: FlowHandlers; // TODO 02Apr20: Should we link to a IoC-style container?
    readonly instanceRespository: IFlowInstanceRepository;
    readonly stackFrames: FlowInstanceStackFrame[];
    asyncRequestId: string;

    readonly resumeStackFrames: FlowInstanceStackFrame[];
    readonly resumeStackFrameCount: number;
    asyncResponse: any;

    constructor(instanceRespository?: IFlowInstanceRepository, instanceId?: string, stackFrames?: FlowInstanceStackFrame[], asyncResponse?: any) {

        this.handlers = new FlowHandlers();
        this.instanceRespository = instanceRespository;
        this.stackFrames = [];

        if (instanceId === undefined) {
            this.instanceId = uuid.v4();
        } else {
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
        this.instanceRespository.save(this.instanceId, this.stackFrames);
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