from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_webhook_request import CreateWebhookRequest
from ...models.created_webhook import CreatedWebhook
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    *,
    body: CreateWebhookRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/admin/webhooks",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreatedWebhook | Problem:
    if response.status_code == 201:
        response_201 = CreatedWebhook.from_dict(response.json())



        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreatedWebhook | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateWebhookRequest,

) -> Response[CreatedWebhook | Problem]:
    """ Create a webhook

     Deliveries are signed per Standard Webhooks (headers `webhook-id`, `webhook-timestamp`, `webhook-
    signature`). The secret is only returned here and when rotated.

    Requires the global permission `admin`.

    Args:
        body (CreateWebhookRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreatedWebhook | Problem]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: CreateWebhookRequest,

) -> CreatedWebhook | Problem | None:
    """ Create a webhook

     Deliveries are signed per Standard Webhooks (headers `webhook-id`, `webhook-timestamp`, `webhook-
    signature`). The secret is only returned here and when rotated.

    Requires the global permission `admin`.

    Args:
        body (CreateWebhookRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreatedWebhook | Problem
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateWebhookRequest,

) -> Response[CreatedWebhook | Problem]:
    """ Create a webhook

     Deliveries are signed per Standard Webhooks (headers `webhook-id`, `webhook-timestamp`, `webhook-
    signature`). The secret is only returned here and when rotated.

    Requires the global permission `admin`.

    Args:
        body (CreateWebhookRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreatedWebhook | Problem]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: CreateWebhookRequest,

) -> CreatedWebhook | Problem | None:
    """ Create a webhook

     Deliveries are signed per Standard Webhooks (headers `webhook-id`, `webhook-timestamp`, `webhook-
    signature`). The secret is only returned here and when rotated.

    Requires the global permission `admin`.

    Args:
        body (CreateWebhookRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreatedWebhook | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
