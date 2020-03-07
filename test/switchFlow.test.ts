import { ActivityRequest, ActivityRequestHandler } from "../src/FlowRequest";
import { FlowRequestHandler } from "../src/FlowRequestHandler";
import { FlowBuilder } from "../src/FlowBuilder";
import { Mediator } from "../src/Mediator";
import { expect } from "chai";

class NullActivityRequest extends ActivityRequest<NullActivityResponse> {
    constructor() {
        super(NullActivityRequest, NullActivityResponse);
    }
}

class NullActivityResponse {
}

class NullActivityHandler extends ActivityRequestHandler<NullActivityRequest, NullActivityResponse> {

    constructor() {
        super(NullActivityRequest);
    }

    handle(request: NullActivityRequest): NullActivityResponse {
        return {};
    }
}

enum Rating {
    Poor = "Poor",
    OK = "OK",
    Good = "Good",
}

class SwitchTestFlowRequest extends ActivityRequest<SwitchTestFlowResponse> {
    constructor() {
        super(SwitchTestFlowRequest, SwitchTestFlowResponse);
    }
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

    constructor(mediator: Mediator) {
        super(SwitchTestFlowRequest, SwitchTestFlowResponse, SwitchTestFlowState, mediator);
    }

    build(flowDefinition: FlowBuilder<SwitchTestFlowRequest, SwitchTestFlowResponse, SwitchTestFlowState>): void {
        flowDefinition
            .initialise(
                (req, state) => { state.value = req.value })

            .when("Value", state => state.value, cases => cases
                .true(value => value >= 70).goto("SetRatingOfGood")
                .true(value => value >= 40).goto("SetRatingOfOk")
            ).else().continue()

            .perform("SetRatingOfPoor", NullActivityRequest, NullActivityResponse,
                (_req, _state) => { },
                (_res, state) => { state.rating = Rating.Poor })
            .end()

            .perform("SetRatingOfOk", NullActivityRequest, NullActivityResponse,
                (_req, _state) => { },
                (_res, state) => { state.rating = Rating.OK })
            .end()

            .perform("SetRatingOfGood", NullActivityRequest, NullActivityResponse,
                (_req, _state) => { },
                (_res, state) => { state.rating = Rating.Good })
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

            const mediator = new Mediator();
            mediator
                .registerHandler(new SwitchTestFlowHandler(mediator))
                .registerHandler(new NullActivityHandler());

            const request = new SwitchTestFlowRequest();
            request.value = theory.value;

            const response = mediator.sendRequest(request) as SwitchTestFlowResponse;

            expect(response?.rating).to.be.equal(theory.expectedRating);
        });
    });
});