from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.webhook_delivery import WebhookDelivery
from typing import cast



def _get_kwargs(
    id: str,
    delivery_id: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/admin/webhooks/{id}/deliveries/{delivery_id}/resend".format(id=quote(str(id), safe=""),delivery_id=quote(str(delivery_id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | WebhookDelivery:
    if response.status_code == 200:
        response_200 = WebhookDelivery.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | WebhookDelivery]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    delivery_id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[Problem | WebhookDelivery]:
    """ Send a delivery again now

     Requires the global permission `admin`.

    Args:
        id (str):
        delivery_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | WebhookDelivery]
     """


    kwargs = _get_kwargs(
        id=id,
delivery_id=delivery_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    delivery_id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Problem | WebhookDelivery | None:
    """ Send a delivery again now

     Requires the global permission `admin`.

    Args:
        id (str):
        delivery_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | WebhookDelivery
     """


    return sync_detailed(
        id=id,
delivery_id=delivery_id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: str,
    delivery_id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[Problem | WebhookDelivery]:
    """ Send a delivery again now

     Requires the global permission `admin`.

    Args:
        id (str):
        delivery_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | WebhookDelivery]
     """


    kwargs = _get_kwargs(
        id=id,
delivery_id=delivery_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    delivery_id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Problem | WebhookDelivery | None:
    """ Send a delivery again now

     Requires the global permission `admin`.

    Args:
        id (str):
        delivery_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | WebhookDelivery
     """


    return (await asyncio_detailed(
        id=id,
delivery_id=delivery_id,
client=client,

    )).parsed
