from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.update_settings import UpdateSettings
from ...models.update_status import UpdateStatus
from typing import cast



def _get_kwargs(
    *,
    body: UpdateSettings,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/admin/updates",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | UpdateStatus:
    if response.status_code == 200:
        response_200 = UpdateStatus.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | UpdateStatus]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: UpdateSettings,

) -> Response[Problem | UpdateStatus]:
    """ Turn the update check on or off

     Once a day the instance reads the public list of releases on GitHub; nothing else is sent. Turning
    it on checks at once.

    Requires the global permission `admin`.

    Args:
        body (UpdateSettings):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | UpdateStatus]
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
    body: UpdateSettings,

) -> Problem | UpdateStatus | None:
    """ Turn the update check on or off

     Once a day the instance reads the public list of releases on GitHub; nothing else is sent. Turning
    it on checks at once.

    Requires the global permission `admin`.

    Args:
        body (UpdateSettings):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | UpdateStatus
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: UpdateSettings,

) -> Response[Problem | UpdateStatus]:
    """ Turn the update check on or off

     Once a day the instance reads the public list of releases on GitHub; nothing else is sent. Turning
    it on checks at once.

    Requires the global permission `admin`.

    Args:
        body (UpdateSettings):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | UpdateStatus]
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
    body: UpdateSettings,

) -> Problem | UpdateStatus | None:
    """ Turn the update check on or off

     Once a day the instance reads the public list of releases on GitHub; nothing else is sent. Turning
    it on checks at once.

    Requires the global permission `admin`.

    Args:
        body (UpdateSettings):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | UpdateStatus
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
