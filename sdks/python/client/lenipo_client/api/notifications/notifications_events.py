from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    
) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/me/events",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Any | Problem:
    if response.status_code == 200:
        response_200 = cast(Any, None)
        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Any | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[Any | Problem]:
    """ Stream the caller’s new notifications (Server-Sent Events)

     Each notification comes as `event: notification` with the notification as JSON and its id as event
    id. After a broken connection, `Last-Event-ID` (or `?after=<id>`) sends what was missed. A comment
    line every 25 seconds keeps proxies from closing the stream.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | Problem]
     """


    kwargs = _get_kwargs(
        
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,

) -> Any | Problem | None:
    """ Stream the caller’s new notifications (Server-Sent Events)

     Each notification comes as `event: notification` with the notification as JSON and its id as event
    id. After a broken connection, `Last-Event-ID` (or `?after=<id>`) sends what was missed. A comment
    line every 25 seconds keeps proxies from closing the stream.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | Problem
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[Any | Problem]:
    """ Stream the caller’s new notifications (Server-Sent Events)

     Each notification comes as `event: notification` with the notification as JSON and its id as event
    id. After a broken connection, `Last-Event-ID` (or `?after=<id>`) sends what was missed. A comment
    line every 25 seconds keeps proxies from closing the stream.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Any | Problem]
     """


    kwargs = _get_kwargs(
        
    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,

) -> Any | Problem | None:
    """ Stream the caller’s new notifications (Server-Sent Events)

     Each notification comes as `event: notification` with the notification as JSON and its id as event
    id. After a broken connection, `Last-Event-ID` (or `?after=<id>`) sends what was missed. A comment
    line every 25 seconds keeps proxies from closing the stream.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Any | Problem
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
