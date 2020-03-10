import { FlowRequestHandler } from "../src/FlowRequestHandler";
import { FlowBuilder } from "../src/FlowBuilder";
import { IActivityRequestHandler, FlowMediator } from "../src/FlowMediator";
import { expect } from "chai";
import { FlowContext } from "../src/FlowContext";

class NullActivityRequest { }

class NullActivityResponse { }

class NullActivityHandler implements IActivityRequestHandler<NullActivityRequest, NullActivityResponse> {
    handle(_flowContext: FlowContext, _request: NullActivityRequest): NullActivityResponse {
        return {};
    }
}

enum Rating {
    Poor = "Poor",
    OK = "OK",
    Good = "Good",
}

class SwitchTestFlowRequest {
    value: number;
}

class SwitchTestFlowResponse {
    rating: Rating;
}

class SwitchTestFlowState {
    value: number;
    rating: Rating;
}

class SwitchTestFlowHandler extends FlowRequestHandler<SwitchTestFlowRequest, SwitchTestFlowResponse, SwitchTestFlowState> {

    flowName = SwitchTestFlowHandler.name;

    constructor(mediator: FlowMediator) {
        super(SwitchTestFlowResponse, SwitchTestFlowState, mediator);
    }

    buildFlow(flowDefinition: FlowBuilder<SwitchTestFlowRequest, SwitchTestFlowResponse, SwitchTestFlowState>) {
        return flowDefinition
            .initialise(
                (req, state) => { state.value = req.value })

            .evaluate("Value", state => state.value, cases => cases
                .when(value => value >= 70).goto("SetRatingOfGood")
                .when(value => value >= 40).goto("SetRatingOfOk")
            ).else().continue()

            .perform("SetRatingOfPoor", NullActivityRequest, NullActivityResponse,
                (_req, _state) => { },
                (_res, state) => { state.rating = Rating.Poor })
            .goto("End")

            .perform("SetRatingOfOk", NullActivityRequest, NullActivityResponse,
                (_req, _state) => { },
                (_res, state) => { state.rating = Rating.OK })
            .goto("End")

            .perform("SetRatingOfGood", NullActivityRequest, NullActivityResponse,
                (_req, _state) => { },
                (_res, state) => { state.rating = Rating.Good })
            .goto("End")

            .label("End")
            .end()

            .finalise(SwitchTestFlowResponse,
                (res, state) => { res.rating = state.rating });
    }
}

describe("Switch test", () => {

    let theories = [
        { value: 39, expectedRating: Rating.Poor },
        { value: 40, expectedRating: Rating.OK },
        { value: 69, expectedRating: Rating.OK },
        { value: 70, expectedRating: Rating.Good },
    ]
    theories.forEach(theory => {
        it(`returns the expected rating ${JSON.stringify(theory)}`, () => {

            const mediator = new FlowMediator();
            mediator
                .registerHandler(NullActivityRequest, NullActivityResponse, new NullActivityHandler());

            const request = new SwitchTestFlowRequest();
            request.value = theory.value;

            const flowContext = new FlowContext();
            
            const response = new SwitchTestFlowHandler(mediator).handle(flowContext, request);

            expect(flowContext.flowName).to.equal(SwitchTestFlowHandler.name);
            expect(flowContext.flowInstanceId).to.be.not.undefined;
            expect(flowContext.stepTrace).to.be.not.undefined;
            expect(response?.rating).to.be.equal(theory.expectedRating);
        });
    });
});