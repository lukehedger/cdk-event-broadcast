import {
  CfnApiDestination,
  CfnConnection,
  CfnRule,
  EventBus,
  // Rule,
} from "@aws-cdk/aws-events";
// import { ApiDestination as ApiDestinationTarget, EventBus as EventBusTarget } from "@aws-cdk/aws-events-targets";
import {
  CfnRegistry,
  CfnRegistryPolicy,
  CfnSchema,
} from "@aws-cdk/aws-eventschemas";
import {
  AccountPrincipal,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "@aws-cdk/aws-iam";
import { Queue } from "@aws-cdk/aws-sqs";
import { Duration } from "@aws-cdk/core";
import {
  Api,
  App,
  Function,
  Stack,
  StackProps,
} from "@serverless-stack/resources";
import EventBroadcastSchema from "../schema/event.broadcast@BROADCAST-v1.json";

interface EventBroadcastStackProps extends StackProps {
  readonly WebhookEndpoint: string;
}

export default class EventBroadcastStack extends Stack {
  constructor(scope: App, id: string, props: EventBroadcastStackProps) {
    super(scope, id, props);

    const broadcastEventBus = new EventBus(this, "BroadcastEventBus", {
      eventBusName: "broadcast-event-bus",
    });

    broadcastEventBus._enableCrossEnvironment();

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

    const eventBroadcastAPIDestinationConnection = new CfnConnection(
      this,
      "EventBroadcastAPIDestinationConnection",
      {
        authorizationType: "API_KEY",
        authParameters: {
          ApiKeyAuthParameters: {
            ApiKeyName: "key",
            ApiKeyValue: "value",
          },
          InvocationHttpParameters: {
            BodyParameters: [
              {
                Key: "key",
                Value: "value",
              },
            ],
          },
        },
      }
    );

    const eventBroadcastAPIDestination = new CfnApiDestination(
      this,
      "EventBroadcastAPIDestination",
      {
        connectionArn: eventBroadcastAPIDestinationConnection.attrArn,
        httpMethod: "POST",
        invocationEndpoint: props.WebhookEndpoint,
        invocationRateLimitPerSecond: 1,
      }
    );

    const apiDestinationEventDLQ = new Queue(this, "APIDestinationEventDLQ");

    const xAccountEventDLQ = new Queue(this, "XAccountEventDLQ");

    // TODO: Use L2 constructs when support for API Destinations is shipped https://github.com/aws/aws-cdk/pull/13729
    // const broadcastRule = new Rule(this, "BroadcastRule", {
    //   eventBus: broadcastEventBus,
    //   eventPattern: {
    //     account: [this.account],
    //     detailType: ["BROADCAST"],
    //     source: ["event.broadcast"],
    //   },
    // });

    // const xAccountEventBus = EventBus.fromEventBusArn(
    //   this,
    //   "XAccountEventBus",
    //   "arn:aws:events:eu-central-1:157983949820:event-bus/gblusthe-x-account-test"
    // );

    // broadcastRule.addTarget(new EventBusTarget(xAccountEventBus));

    // broadcastRule.addTarget(new ApiDestinationTarget(eventBroadcastAPIDestination));

    // TODO: Remove IAM roles when support for API Destinations is shipped
    const xAccountEventRole = new Role(this, "XAccountEventRole", {
      assumedBy: new ServicePrincipal("events.amazonaws.com"),
      inlinePolicies: {
        defaultPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["events:PutEvents"],
              resources: [
                "arn:aws:events:eu-central-1:157983949820:event-bus/gblusthe-x-account-test",
              ],
            }),
          ],
        }),
      },
    });

    const apiDestinationEventRole = new Role(this, "APIDestinationEventRole", {
      assumedBy: new ServicePrincipal("events.amazonaws.com"),
      inlinePolicies: {
        defaultPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["events:InvokeApiDestination"],
              resources: [
                `arn:aws:events:${this.region}:${this.account}:api-destination/${eventBroadcastAPIDestination.ref}/*`,
              ],
            }),
          ],
        }),
      },
    });

    // TODO: Remove CfnRule when support for API Destinations is shipped
    new CfnRule(this, "BroadcastRule", {
      eventBusName: broadcastEventBus.eventBusName,
      eventPattern: {
        account: [this.account],
        "detail-type": ["BROADCAST"],
        source: ["event.broadcast"],
      },
      name: "BroadcastRule",
      targets: [
        {
          arn: "arn:aws:events:eu-central-1:157983949820:event-bus/gblusthe-x-account-test",
          deadLetterConfig: {
            arn: xAccountEventDLQ.queueArn,
          },
          id: "Target0",
          roleArn: xAccountEventRole.roleArn,
        },
        {
          arn: eventBroadcastAPIDestination.attrArn,
          deadLetterConfig: {
            arn: apiDestinationEventDLQ.queueArn,
          },
          id: "Target1",
          roleArn: apiDestinationEventRole.roleArn,
        },
      ],
    });

    const eventBroadcastSchemaRegistry = new CfnRegistry(
      this,
      "EventBroadcastSchemaRegistry",
      {
        registryName: "EventBroadcastSchemaRegistry",
      }
    );

    const broadcastEventSchema = new CfnSchema(this, "BroadcastEventSchema", {
      content: JSON.stringify(EventBroadcastSchema),
      registryName: eventBroadcastSchemaRegistry.attrRegistryName,
      schemaName: "BroadcastEventSchema",
      type: "JSONSchemaDraft4",
    });

    new CfnRegistryPolicy(this, "EventBroadcastSchemaRegistryPolicy", {
      policy: new PolicyDocument({
        statements: [
          new PolicyStatement({
            actions: ["schemas:*"],
            principals: [new AccountPrincipal("157983949820")],
            resources: [
              `arn:aws:events:${this.region}:${this.account}:registry/${eventBroadcastSchemaRegistry.ref}`,
              `arn:aws:events:${this.region}:${this.account}:schema/${eventBroadcastSchemaRegistry.ref}/${broadcastEventSchema.ref}`,
            ],
          }),
        ],
      }),
      registryName: eventBroadcastSchemaRegistry.attrRegistryName,
    });

    this.addOutputs({
      ApiEndpoint: broadcastAPI.url,
    });
  }
}
