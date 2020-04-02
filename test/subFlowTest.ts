import { FlowRequestHandler } from "../src/FlowRequestHandler";
import { FlowBuilder } from "../src/FlowBuilder";
import { FlowDefinition } from "../src/FlowDefinition";
import { FlowHandlers, IActivityRequestHandler } from "../src/FlowHandlers";
import { FlowContext, FlowInstanceStackFrame } from "../src/FlowContext";
import { expect } from "chai";
import { IFlowInstanceRepository } from "../src/FlowInstanceRepository";

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
    requestJson: string;
    public handle(_flowContext: FlowContext, request: SumActivityRequest): SumActivityResponse {
        this.requestJson = JSON.stringify(request);
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

    private readonly _flowInstances: Map<string, string> = new Map<string, string>();

    save(instanceId: string, stackFrames: FlowInstanceStackFrame[]) {
        this._flowInstances[instanceId] = JSON.stringify(stackFrames);
    }

    load(instanceId: string): FlowInstanceStackFrame[] {
        return JSON.parse(this._flowInstances[instanceId]);
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
    a: number; b: number; c: number; d: number;
}
class ParentFlowResponse {
    total: number;
}
class ParentFlowState {
    a: number; b: number; c: number; d: number;
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
                state.a = req.a; state.b = req.b; state.c = req.c; state.d = req.d;
            })
            .perform("Add a and b", ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.a; req.value2 = state.b; },
                (res, state) => { state.total = res.total; })
            .perform("Add c and total", ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.c; req.value2 = state.total; },
                (res, state) => { state.total = res.total; })
            .perform("Add d and total", ChildFlowRequest, ChildFlowResponse,
                (req, state) => { req.value1 = state.d; req.value2 = state.total; },
                (res, state) => { state.total = res.total; })
            .finalise(ParentFlowResponse, (res, state) => {
                res.total = state.total;
            });
    }
}

describe('Handlers', () => {

    it('returns the total of the inputs when activity invoked synchronously', () => {

        const flowContext = new FlowContext();
        flowContext.handlers
            .register(SumActivityRequest, SumActivityResponse, new SyncSumActivityHandler())
            .register(ChildFlowRequest, ChildFlowResponse, new ChildFlowHandler());

        const request = new ParentFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;
        request.d = 50;

        const response = new ParentFlowHandler().handle(flowContext, request);

        expect(flowContext.instanceId).to.be.not.undefined;
        expect(response?.total).to.be.equal(666);
    });

    it('returns the total of the inputs when activity invoked asynchronously', () => {

        const flowInstanceRepository = new InMemoryFlowInstanceRepository();
        const asyncSumActivityHandler = new AsyncSumActivityHandler();

        let flowContext = new FlowContext(flowInstanceRepository);
        addAsyncHandlers(flowContext, asyncSumActivityHandler);

        const request = new ParentFlowRequest();
        request.a = 200;
        request.b = 210;
        request.c = 206;
        request.d = 50;

        const response01 = new ParentFlowHandler().handle(flowContext, request);

        expect(flowContext.instanceId).to.not.be.undefined;
        expect(flowInstanceRepository.load(flowContext.instanceId)).to.not.be.undefined;
        expect(response01).to.be.undefined;

        // Send back asynchronous response 01

        const asyncRequestJson01 = asyncSumActivityHandler.requestJson;

        const asyncResponse01 =
            new SyncSumActivityHandler().handle(new FlowContext(), JSON.parse(asyncRequestJson01));

        flowContext = new FlowContext(flowInstanceRepository, flowContext.instanceId, asyncResponse01);
        addAsyncHandlers(flowContext, asyncSumActivityHandler);

        const response02 = new ParentFlowHandler().handle(flowContext);

        expect(flowContext.instanceId).to.not.be.undefined;
        expect(flowInstanceRepository.load(flowContext.instanceId)).to.not.be.undefined;
        expect(response02).to.be.undefined;

        const firstInstanceId = flowContext.instanceId;

        // Send back asynchronous response 02

        const asyncRequestJson02 = asyncSumActivityHandler.requestJson;

        const asyncResponse02 =
            new SyncSumActivityHandler().handle(new FlowContext(), JSON.parse(asyncRequestJson02));

        flowContext = new FlowContext(flowInstanceRepository, flowContext.instanceId, asyncResponse02);
        addAsyncHandlers(flowContext, asyncSumActivityHandler);

        const response03 = new ParentFlowHandler().handle(flowContext);

        expect(flowContext.instanceId).to.not.be.undefined;
        expect(flowContext.instanceId).equal(firstInstanceId);
        expect(flowInstanceRepository.load(flowContext.instanceId)).to.not.be.undefined;
        expect(response03).to.be.undefined;

        // Send back asynchronous response 03

        const asyncRequestJson03 = asyncSumActivityHandler.requestJson;

        const asyncResponse03 =
            new SyncSumActivityHandler().handle(new FlowContext(), JSON.parse(asyncRequestJson03));

        flowContext = new FlowContext(flowInstanceRepository, flowContext.instanceId, asyncResponse03);
        addAsyncHandlers(flowContext, asyncSumActivityHandler);

        const response04 = new ParentFlowHandler().handle(flowContext);

        expect(flowContext.instanceId).to.be.not.undefined;
        expect(flowContext.instanceId).equal(firstInstanceId);
        expect(response04.total).to.be.equal(666);
    });
});

function addAsyncHandlers(flowContext: FlowContext, asyncSumActivityHandler: AsyncSumActivityHandler) {
    flowContext.handlers
        .register(SumActivityRequest, SumActivityResponse, asyncSumActivityHandler)
        .register(ChildFlowRequest, ChildFlowResponse, new ChildFlowHandler());
}
