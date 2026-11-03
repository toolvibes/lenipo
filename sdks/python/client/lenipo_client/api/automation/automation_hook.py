from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.automation_hook_response_202 import AutomationHookResponse202
from ...models.incoming_webhook_request import IncomingWebhookRequest
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    id: str,
    *,
    body: IncomingWebhookRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/automation/hooks/{id}".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> AutomationHookResponse202 | Problem:
    if response.status_code == 202:
        response_202 = AutomationHookResponse202.from_dict(response.json())



        return response_202

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[AutomationHookResponse202 | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: IncomingWebhookRequest,

) -> Response[AutomationHookResponse202 | Problem]:
    """ Start a rule with an incoming webhook trigger

     Called by other systems with the secret from the rule: preferably in a header (`Authorization:
    Bearer <secret>` or `X-Lenipo-Token`), or as `?token=`. Optionally `{"issues": ["KEY-1"]}` runs it
    for those issues; the whole body is available as {{webhookData}}.

    Args:
        id (str):
        body (IncomingWebhookRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AutomationHookResponse202 | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: IncomingWebhookRequest,

) -> AutomationHookResponse202 | Problem | None:
    """ Start a rule with an incoming webhook trigger

     Called by other systems with the secret from the rule: preferably in a header (`Authorization:
    Bearer <secret>` or `X-Lenipo-Token`), or as `?token=`. Optionally `{"issues": ["KEY-1"]}` runs it
    for those issues; the whole body is available as {{webhookData}}.

    Args:
        id (str):
        body (IncomingWebhookRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AutomationHookResponse202 | Problem
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: IncomingWebhookRequest,

) -> Response[AutomationHookResponse202 | Problem]:
    """ Start a rule with an incoming webhook trigger

     Called by other systems with the secret from the rule: preferably in a header (`Authorization:
    Bearer <secret>` or `X-Lenipo-Token`), or as `?token=`. Optionally `{"issues": ["KEY-1"]}` runs it
    for those issues; the whole body is available as {{webhookData}}.

    Args:
        id (str):
        body (IncomingWebhookRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AutomationHookResponse202 | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: IncomingWebhookRequest,

) -> AutomationHookResponse202 | Problem | None:
    """ Start a rule with an incoming webhook trigger

     Called by other systems with the secret from the rule: preferably in a header (`Authorization:
    Bearer <secret>` or `X-Lenipo-Token`), or as `?token=`. Optionally `{"issues": ["KEY-1"]}` runs it
    for those issues; the whole body is available as {{webhookData}}.

    Args:
        id (str):
        body (IncomingWebhookRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AutomationHookResponse202 | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
