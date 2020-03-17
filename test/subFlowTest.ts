import { FlowRequestHandler } from "../src/FlowRequestHandler";
import { FlowBuilder } from "../src/FlowBuilder";
import { FlowDefinition } from "../src/FlowDefinition";
import { FlowHandlers, IActivityRequestHandler } from "../src/FlowHandlers";
import { FlowContext } from "../src/FlowContext";
import { expect } from "chai";
import { IFlowInstanceRepository, FlowInstance } from "../src/FlowInstanceRepository";

class SumActivityRequest {
    values: number[];
}

class SumActivityResponse {
    total: number;
}

class SyncSumActivityHandler implements IActivityRequestHandler<SumActivityRequest, SumActivityResponse> {
    public handle(_flowContext: FlowContext, request: SumActivityRequest): SumActivityResponse {
        const total = request.values.reduce((a, b) => a + b, 0);
        return { total: total };
    }
}

class AsyncSumActivityHandler implements IActivityRequestHandler<SumActivityRequest, SumActivityResponse> {
    request: SumActivityRequest;
    public handle(_flowContext: FlowContext, request: SumActivityRequest): SumActivityResponse {
        this.request = request;
        return undefined;
    }
}

class ChildFlowRequest {
    value1: number; value2: number;
}
class ChildFlowResponse {
    total: number;
}
class ChildFlowState {
    total: number;
    value1: number; value2: number;
}

class InMemoryFlowInstanceRepository implements IFlowInstanceRepository {

    private readonly _flowInstances: Map<string, FlowInstance> = new Map<string, FlowInstance>();

    save(flowInstance: FlowInstance) {
        this._flowInstances[flowInstance.id] = flowInstance;
    }

    load(instanceId: string): FlowInstance {
        return this._flowInstances[instanceId];
    }
}

class ChildFlowHandler extends FlowRequestHandler<ChildFlowRequest, ChildFlowResponse, ChildFlowState> {

    flowName = ChildFlowHandler.name;

    constructor() {
        super(ChildFlowResponse, ChildFlowState);
    }

    buildFlow(flowBuilder: FlowBuilder<ChildFlowRequest, ChildFlowResponse, ChildFlowState>): FlowDefinition<ChildFlowRequest, ChildFlowResponse, ChildFlowState> {
        return flowBuilder
            .initialise((req, state) => {
                state.value1 = req.value1; state.value2 = req.value2;
            })
            .perform("Sum value 1 and 2", SumActivityRequest, SumActivityResponse,
                (req, state) => { req.values = [state.value1, state.value2]; },
                (res, state) => { state.total = res.total; })
            .finalise(ChildFlowResponse, (res, state) => {
                res.total = state.total;
            });
    }
}

class ParentFlowRequest {
    a: number; b: number; c: number;
}
class ParentFlowResponse {
    total: number;
}
class ParentFlowState {
    a: number; b: number; c: number;
    total: number;
}

class ParentFlowHandler extends FlowRequestHandler<ParentFlowRequest, ParentFlowResponse, ParentFlowState> {

    flowName = ParentFlowHandler.name;

    constructor() {
        super(ParentFlowResponse, ParentFlowState);
    }

    protected debugPreActivityRequest(_stepName: string, _request: any, _state: any) { }
    protected debugPostActivityResponse(_stepName: string, _response: any, _state: any) { }

    buildFlow(flowBuilder: FlowBuilder<ParentFlowRequest, ParentFlowResponse, ParentFlowState>): FlowDefinition<ParentFlowRequest, ParentFlowResponse, ParentFlowState> {
        return flowBuilder
            .initialise((req, state) => {
                state.a = req.a; state.b = req.b; state.c = req.c;
            })
            .perform("Add a and b", ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.a; req.value2 = state.b; },
                (res, state) => { state.total = res.total; })
            .perform("Add c and total", ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.c; req.value2 = state.total; },
                (res, state) => { state.total = res.total; })
            .finalise(ParentFlowResponse, (res, state) => {
                res.total = state.total;
            });
    }
}

describe('Handlers', () => {

    it('returns the total of the inputs when activity invoked synchronously', () => {

        const flowContext = FlowContext.newContext();
        flowContext.handlers
            .register(SumActivityRequest, SumActivityResponse, new SyncSumActivityHandler())
            .register(ChildFlowRequest, ChildFlowResponse, new ChildFlowHandler());

        const request = new ParentFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;

        const response = new ParentFlowHandler().handle(flowContext, request);

        // TODO 10Mar20: How should FlowContext go between flows?
        expect(flowContext.rootInstanceId).to.be.not.undefined;
        expect(response?.total).to.be.equal(616);
    });

    it.only('returns the total of the inputs when activity invoked asynchronously', () => {

        const flowInstanceRepository = new InMemoryFlowInstanceRepository();
        const asyncSumActivityHandler = new AsyncSumActivityHandler();

        let flowContext = newAsyncFlowContext(flowInstanceRepository, asyncSumActivityHandler);

        const request = new ParentFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;

        const response01 = new ParentFlowHandler().handle(flowContext, request);

        expect(flowContext.rootInstanceId).to.not.be.undefined;
        expect(flowInstanceRepository.load(flowContext.rootInstanceId)).to.not.be.undefined;
        expect(response01).to.be.undefined;

        // Send back asynchronous response 01

        const asyncResponse01 =
            new SyncSumActivityHandler().handle(FlowContext.newContext(), asyncSumActivityHandler.request);

        flowContext = newResumeFlowContext(flowContext.rootInstanceId, asyncResponse01, flowInstanceRepository, asyncSumActivityHandler);

        const response02 = new ParentFlowHandler().handle(flowContext);

        expect(flowContext.rootInstanceId).to.not.be.undefined;
        expect(flowInstanceRepository.load(flowContext.rootInstanceId)).to.not.be.undefined;
        expect(response02).to.be.undefined;

        // Send back asynchronous response 02

        const asyncResponse02 =
            new SyncSumActivityHandler().handle(FlowContext.newContext(), asyncSumActivityHandler.request);

        flowContext = newResumeFlowContext(flowContext.rootInstanceId, asyncResponse02, flowInstanceRepository, asyncSumActivityHandler);

        const response03 = new ParentFlowHandler().handle(flowContext);

        expect(flowContext.rootInstanceId).to.be.not.undefined;
        expect(response03.total).to.be.equal(616);
    });
});

function newAsyncFlowContext(flowInstanceRepository: InMemoryFlowInstanceRepository, asyncSumActivityHandler: AsyncSumActivityHandler) {

    const flowContext = FlowContext.newContext(flowInstanceRepository);

    addAsyncHandlers(flowContext, asyncSumActivityHandler);

    return flowContext;
}

function newResumeFlowContext(instanceId: string, asyncResponse: any,
    flowInstanceRepository: InMemoryFlowInstanceRepository, asyncSumActivityHandler: AsyncSumActivityHandler) {

    const flowContext = FlowContext.newResumeContext(instanceId, asyncResponse, flowInstanceRepository);
    
    addAsyncHandlers(flowContext, asyncSumActivityHandler);

    return flowContext;
}

function addAsyncHandlers(flowContext: FlowContext, asyncSumActivityHandler: AsyncSumActivityHandler) {
    flowContext.handlers
        .register(SumActivityRequest, SumActivityResponse, asyncSumActivityHandler)
        .register(ChildFlowRequest, ChildFlowResponse, new ChildFlowHandler());
}
