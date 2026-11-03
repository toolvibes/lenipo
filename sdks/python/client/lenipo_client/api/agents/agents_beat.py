from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.presence import Presence
from ...models.problem import Problem
from ...models.update_presence_request import UpdatePresenceRequest
from typing import cast



def _get_kwargs(
    *,
    body: UpdatePresenceRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/me/presence",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Presence | Problem:
    if response.status_code == 200:
        response_200 = Presence.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Presence | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: UpdatePresenceRequest,

) -> Response[Presence | Problem]:
    """ Send a heartbeat: state and what one is working on

     Mainly for agents, e.g. at the start and end of each run. Without a new heartbeat for 30 minutes the
    state counts as offline. `issueKey` and `branch` stay as they are when left out; null clears them.

    Args:
        body (UpdatePresenceRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Presence | Problem]
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
    body: UpdatePresenceRequest,

) -> Presence | Problem | None:
    """ Send a heartbeat: state and what one is working on

     Mainly for agents, e.g. at the start and end of each run. Without a new heartbeat for 30 minutes the
    state counts as offline. `issueKey` and `branch` stay as they are when left out; null clears them.

    Args:
        body (UpdatePresenceRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Presence | Problem
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: UpdatePresenceRequest,

) -> Response[Presence | Problem]:
    """ Send a heartbeat: state and what one is working on

     Mainly for agents, e.g. at the start and end of each run. Without a new heartbeat for 30 minutes the
    state counts as offline. `issueKey` and `branch` stay as they are when left out; null clears them.

    Args:
        body (UpdatePresenceRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Presence | Problem]
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
    body: UpdatePresenceRequest,

) -> Presence | Problem | None:
    """ Send a heartbeat: state and what one is working on

     Mainly for agents, e.g. at the start and end of each run. Without a new heartbeat for 30 minutes the
    state counts as offline. `issueKey` and `branch` stay as they are when left out; null clears them.

    Args:
        body (UpdatePresenceRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Presence | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
