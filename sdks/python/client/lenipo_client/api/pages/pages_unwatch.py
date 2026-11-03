from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.pages_unwatch_scope import PagesUnwatchScope
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    id: str,
    *,
    scope: PagesUnwatchScope | Unset = PagesUnwatchScope.PAGE,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_scope: str | Unset = UNSET
    if not isinstance(scope, Unset):
        json_scope = scope.value

    params["scope"] = json_scope


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/api/v1/pages/{id}/watch".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem:
    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem]:
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
    scope: PagesUnwatchScope | Unset = PagesUnwatchScope.PAGE,

) -> Response[Problem]:
    """ Stop watching a page

    Args:
        id (str):
        scope (PagesUnwatchScope | Unset):  Default: PagesUnwatchScope.PAGE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem]
     """


    kwargs = _get_kwargs(
        id=id,
scope=scope,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    scope: PagesUnwatchScope | Unset = PagesUnwatchScope.PAGE,

) -> Problem | None:
    """ Stop watching a page

    Args:
        id (str):
        scope (PagesUnwatchScope | Unset):  Default: PagesUnwatchScope.PAGE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem
     """


    return sync_detailed(
        id=id,
client=client,
scope=scope,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    scope: PagesUnwatchScope | Unset = PagesUnwatchScope.PAGE,

) -> Response[Problem]:
    """ Stop watching a page

    Args:
        id (str):
        scope (PagesUnwatchScope | Unset):  Default: PagesUnwatchScope.PAGE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem]
     """


    kwargs = _get_kwargs(
        id=id,
scope=scope,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    scope: PagesUnwatchScope | Unset = PagesUnwatchScope.PAGE,

) -> Problem | None:
    """ Stop watching a page

    Args:
        id (str):
        scope (PagesUnwatchScope | Unset):  Default: PagesUnwatchScope.PAGE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
scope=scope,

    )).parsed
