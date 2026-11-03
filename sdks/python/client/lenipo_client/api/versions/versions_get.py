from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.release import Release
from typing import cast



def _get_kwargs(
    key: str,
    id: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/projects/{key}/releases/{id}".format(key=quote(str(key), safe=""),id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | Release:
    if response.status_code == 200:
        response_200 = Release.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | Release]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[Problem | Release]:
    """ A version’s progress, issues by status and warnings

    Args:
        key (str):
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | Release]
     """


    kwargs = _get_kwargs(
        key=key,
id=id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Problem | Release | None:
    """ A version’s progress, issues by status and warnings

    Args:
        key (str):
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | Release
     """


    return sync_detailed(
        key=key,
id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    key: str,
    id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[Problem | Release]:
    """ A version’s progress, issues by status and warnings

    Args:
        key (str):
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | Release]
     """


    kwargs = _get_kwargs(
        key=key,
id=id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Problem | Release | None:
    """ A version’s progress, issues by status and warnings

    Args:
        key (str):
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | Release
     """


    return (await asyncio_detailed(
        key=key,
id=id,
client=client,

    )).parsed
