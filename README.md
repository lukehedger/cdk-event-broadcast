# CDK Event Broadcast

Using EventBridge to broadcast events to external parties, via API Destinations and Cross-Account Events.

## Commands

### Install dependencies

```sh
npm install
```

### Local development

Deploy the local development debug stack and services:

```sh
npm start
```

#### Remove local development stack

```sh
npm run remove
```

### Build

```sh
npm run build
```

### Test

```sh
npm test
```

## Cross-Account Events

To [send events to an EventBridge event bus in another account](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cross-account.html), you must first configure the target bus with the [necessary permissions](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-bus-perms.html#eb-event-bus-example-policy-cross-account-custom-bus-source):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "allow_account_to_put_events",
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::{SOURCE_ACCOUNT_ID}:root"
    },
    "Action": "events:PutEvents",
    "Resource": "arn:aws:events:{TARGET_REGION}:{TARGET_ACCOUNT_ID}:event-bus/{TARGET_EVENT_BUS_NAME}"
  }]
}
```

## Code Bindings

Generate TypeScript code bindings from event schema by following [these instructions](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-schema-code-bindings.html) or running:

```sh
npm run generate:types
```

---

## TODO
- [ ] Add event producer integration test
- [ ] Add event broadcast stack tests
- [ ] Add input transformer example, with tests
