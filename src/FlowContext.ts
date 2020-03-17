import uuid = require("uuid");
import { FlowStep, FlowStepType } from "./FlowDefinition";
import { FlowHandlers } from "./FlowHandlers";
import { IFlowInstanceRepository, FlowInstance } from "./FlowInstanceRepository";

export class ResumePoint {
    constructor(public stepName: string, public state: any) {
    }
}

export class FlowContext {

    // TODO 14Mar20: Add tracing to the FlowContext
    // TODO 08Mar20: This could contain: logging methods, mocks and 'headers'
    // TODO 08Mar20: We wouldn't want mocks to be serialized

    readonly rootInstanceId: string;
    readonly instanceRespository: IFlowInstanceRepository;
    readonly handlers: FlowHandlers;

    readonly instanceId: string;
    readonly flowName: string;

    readonly resumePoints: ResumePoint[];
    asyncResponse: any;

    resumeStepName: string;
    stepName: string;

    readonly state: any;
    private readonly _contextStack: FlowContext[];

    private readonly _isResumption: boolean[] = [false];

    get isResumption(): boolean {
        return this._isResumption[0];
    }

    set isResumption(value: boolean) {
        this._isResumption[0] = value;
    }

    private constructor(
        instanceId: string, handlers?: FlowHandlers, instanceRespository?: IFlowInstanceRepository,
        parentContext?: FlowContext, flowName?: string, state?: any,
        resumePoints?: ResumePoint[], asyncResponse?: any) {

        if (parentContext !== undefined) {

            // TODO 14Mar20: Allow for a set of 'flow headers' that are passed down the chain of contexts

            this.rootInstanceId = parentContext.rootInstanceId;
            this.handlers = parentContext.handlers;
            this.instanceRespository = parentContext.instanceRespository;

            this._contextStack = parentContext._contextStack.slice();
            this._contextStack.push(parentContext);

            this.resumePoints = parentContext.resumePoints;
            this.asyncResponse = parentContext.asyncResponse;
            this._isResumption = parentContext._isResumption;
        }
        else {

            this.rootInstanceId = instanceId;
            this.handlers = handlers;
            this.instanceRespository = instanceRespository;

            this._contextStack = [];

            this.resumePoints = resumePoints;
            this.asyncResponse = asyncResponse;
            this.isResumption = (asyncResponse !== undefined);
        }

        this.instanceId = instanceId;
        this.flowName = flowName;
        this.state = state;
    }

    static newContext(instanceRespository?: IFlowInstanceRepository): FlowContext {
        const context = new FlowContext(FlowContext.newId(), new FlowHandlers(), instanceRespository);
        return context;
    }

    static newChildContext(parentContext: FlowContext, flowName: string, state: any): FlowContext {

        // TODO 15Mar20: If we are resuming, then we would want to remember the id from the first time

        if (parentContext.isResumption) {

            const resumePoint = parentContext.resumePoints.pop();

            const childContext =
                new FlowContext(FlowContext.newId(), undefined, undefined, parentContext, flowName, resumePoint.state);

            childContext.resumeStepName = resumePoint.stepName;

            return childContext;
        }
        else {
            const childContext =
                new FlowContext(FlowContext.newId(), undefined, undefined, parentContext, flowName, state);
            return childContext;
        }
    }

    static newResumeContext(instanceId: string, asyncResponse: any, instanceRespository: IFlowInstanceRepository): FlowContext {

        const flowInstance = instanceRespository.load(instanceId);

        if (flowInstance === undefined) {
            throw new Error(`No flow instance found with the id: ${instanceId}`);
        }

        const context =
            new FlowContext(
                instanceId, new FlowHandlers(), instanceRespository,
                undefined, undefined, undefined,
                flowInstance.resumePoints, asyncResponse);

        return context
    }

    saveInstance() {
        if (this._contextStack.length > 0) {

            const resumePoints: ResumePoint[] = [new ResumePoint(this.stepName, this.state)];

            while (this._contextStack.length > 1) {
                const context = this._contextStack.pop();
                resumePoints.push(new ResumePoint(context.stepName, context.state));
            }

            const flowInstance = new FlowInstance(this.rootInstanceId, resumePoints);

            this.instanceRespository.save(flowInstance);

            this._contextStack.splice(0, this._contextStack.length); // Clear the stack
        }
    }

    loadInstance(instanceId: string) {
        return this.instanceRespository.load(instanceId);
    }

    private static newId(): string {
        return uuid.v1();
    }
}