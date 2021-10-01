import { CfnApiDestination, EventBus, Rule } from "@aws-cdk/aws-events";
import { EventBus as EventBusTarget } from "@aws-cdk/aws-events-targets";
import { Duration } from "@aws-cdk/core";
import {
  Api,
  App,
  Function,
  Stack,
  StackProps,
} from "@serverless-stack/resources";

interface EventBroadcastStackProps extends StackProps {
  readonly WebhookEndpoint: string;
}

export default class EventBroadcastStack extends Stack {
  constructor(scope: App, id: string, props: EventBroadcastStackProps) {
    super(scope, id, props);

    const broadcastEventBus = new EventBus(this, "BroadcastEventBus", {
      eventBusName: "broadcast-event-bus",
    });

    broadcastEventBus.archive("BroadcastEventArchive", {
      archiveName: "BroadcastEventArchive",
      description: "BroadcastEventBus Archive",
      eventPattern: {
        account: [this.account],
      },
      retention: Duration.days(2),
    });

    const eventProducerFunction = new Function(this, "EventProducerFunction", {
      environment: {
        EVENT_BUS_NAME: broadcastEventBus.eventBusName,
      },
      handler: "src/eventProducer.handler",
    });

    const broadcastAPI = new Api(this, "BroadcastAPI");

    broadcastAPI.addRoutes(this, { "POST /": eventProducerFunction });

    eventProducerFunction.attachPermissions([
      [broadcastEventBus, "grantPutEventsTo"],
    ]);

    const broadcastRule = new Rule(this, "BroadcastRule", {
      eventBus: broadcastEventBus,
      eventPattern: {
        account: [this.account],
        detailType: ["BROADCAST"],
        source: ["event.broadcast"],
      },
    });

    broadcastRule.addTarget(
      new EventBusTarget(
        EventBus.fromEventBusArn(
          this,
          "XAccountEventBus",
          "TODO - deploy a bus from another stack to another account and share ARN"
        )
      )
    );

    const eventBroadcastAPIDestination = new CfnApiDestination(
      this,
      "EventBroadcastAPIDestination",
      {
        connectionArn:
          "TODO - https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-events.CfnConnection.html",
        httpMethod: "POST",
        invocationEndpoint: props.WebhookEndpoint,
        invocationRateLimitPerSecond: 1,
      }
    );

    // TODO: Add eventBroadcastAPIDestination to broadcastRule targets

    // TODO: Setup custom schema registry and add custom schema https://docs.aws.amazon.com/cdk/api/latest/docs/aws-eventschemas-readme.html

    this.addOutputs({
      ApiEndpoint: broadcastAPI.url,
    });
  }
}
