
export abstract class ActivityRequest<T> {

    handlerKey: string;

    constructor(req: new () => ActivityRequest<T>, res: new () => T) {
        this.handlerKey = `${req.name}>>>${res.name}`;
    }
}

export abstract class ActivityRequestHandler<TReq extends ActivityRequest<TRes>, TRes> {

    key: string;

    constructor(RequestType: new () => TReq) {
        this.key = new RequestType().handlerKey;
    }

    // TODO 08Mar20: Is this where we pass through the FlowContext?
    abstract handle(request: TReq): TRes;
}

