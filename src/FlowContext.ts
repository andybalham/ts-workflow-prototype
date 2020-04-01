import uuid = require("uuid");
import { FlowHandlers } from "./FlowHandlers";
import { IFlowInstanceRepository, FlowInstance } from "./FlowInstanceRepository";

export class FlowContext {

    readonly instanceId: string;
    readonly handlers: FlowHandlers;
    readonly instanceRespository: IFlowInstanceRepository;
    readonly stackFrames: FlowInstanceStackFrame[];
    
    isResume: any;
    resumeStepName: string;
    resumePoints: any;
    asyncResponse: any;

    constructor(instanceRespository?: IFlowInstanceRepository) {

        this.instanceId = uuid.v4();
        this.handlers = new FlowHandlers();
        this.instanceRespository = instanceRespository;        
        this.stackFrames = [];
    }

    get currentStackFrame(): FlowInstanceStackFrame {
        return this.stackFrames[this.stackFrames.length - 1];
    }

    saveInstance() {
        throw new Error("Method not implemented.");
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