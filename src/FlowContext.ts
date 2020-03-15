import uuid = require("uuid");
import { FlowStep, FlowStepType } from "./FlowDefinition";
import { FlowHandlers } from "./FlowHandlers";
import { IFlowInstanceRepository, FlowInstance } from "./FlowInstanceRepository";

export class ResumePoint {
    stepName: string;
    state: any;
}

export class FlowContext {

    // TODO 14Mar20: Add tracing to the FlowContext
    // TODO 08Mar20: This could contain: logging methods, mocks and 'headers'
    // TODO 08Mar20: We wouldn't want mocks to be serialized

    private readonly _contextStack: FlowContext[] = [];
    private readonly _handlers: FlowHandlers;
    private readonly _instanceRespository: IFlowInstanceRepository;
    private readonly _state: any;

    private readonly _flowInstance: FlowInstance;
    private readonly _asyncResponse: any;

    get rootInstanceId(): string {
        return (this._contextStack.length > 0) ? this._contextStack[0].instanceId : this.instanceId;
    }

    get handlers(): FlowHandlers {
        return (this._contextStack.length > 0) ? this._contextStack[0]._handlers : this._handlers;
    }

    private get instanceRespository(): IFlowInstanceRepository {
        return (this._contextStack.length > 0) ? this._contextStack[0]._instanceRespository : this._instanceRespository;
    }

    get flowInstance(): FlowInstance {
        return (this._contextStack.length > 0) ? this._contextStack[0]._flowInstance : this._flowInstance;
    }

    get asyncResponse(): FlowInstance {
        return (this._contextStack.length > 0) ? this._contextStack[0]._asyncResponse : this._asyncResponse;
    }

    resumePoints: ResumePoint[];

    get isResumption(): boolean {
        return this.resumePoints !== undefined;
    }

    readonly instanceId: string;
    readonly flowName: string;
    stepName: string;

    private constructor(instanceId: string,
        handlers?: FlowHandlers, instanceRespository?: IFlowInstanceRepository,
        parentContext?: FlowContext, flowName?: string, state?: any,
        flowInstance?: FlowInstance, asyncResponse?: any) {

        this.instanceId = instanceId;
        this.flowName = flowName;

        this._state = state;
        this._handlers = handlers;
        this._instanceRespository = instanceRespository;

        this._flowInstance = flowInstance;
        this._asyncResponse = asyncResponse;

        if (parentContext !== undefined) {
            this._contextStack = parentContext._contextStack;
            this._contextStack.push(parentContext);
        }
    }

    static newContext(instanceRespository?: IFlowInstanceRepository): FlowContext {
        // TODO 14Mar20: Allow for a set of 'flow headers' that are passed down the chain of contexts
        const instanceId = FlowContext.newId();
        const context = new FlowContext(instanceId, new FlowHandlers(), instanceRespository);
        return context;
    }

    static newChildContext(parentContext: FlowContext, flowName: string, state: any): FlowContext {

        const childContext =
            new FlowContext(FlowContext.newId(), undefined, undefined, parentContext, flowName, state);

        // TODO 14Mar20: Would we want to pass through details such as correlation ids?
        return childContext;
    }

    static newResumeContext(instanceId: string, instanceRespository: IFlowInstanceRepository, asyncResponse: any): FlowContext {

        const flowInstance = instanceRespository.load(instanceId);

        if (flowInstance === undefined) {
            throw new Error(`No flow instance found with the id: ${instanceId}`);
        }

        const context =
            new FlowContext(
                instanceId, new FlowHandlers(), instanceRespository,
                undefined, undefined, undefined,
                flowInstance, asyncResponse);

        // TODO 15Mar20: How to set the ResumePoints?
        
        return context
    }

    saveInstance() {
        // TODO 14Mar20: Save the contexts and the state in readiness for the response later
        if (this._contextStack.length > 0) {
            this.instanceRespository.save(new FlowInstance(this.rootInstanceId));
            this._contextStack.splice(0, this._contextStack.length); // Clear 
        }
    }

    loadInstance(instanceId: string) {
        return this.instanceRespository.load(instanceId);
    }

    private static newId(): string {
        return uuid.v1();
    }
}