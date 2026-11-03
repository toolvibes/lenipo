from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.page_analytics import PageAnalytics
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    id: str,
    *,
    days: int | Unset = 30,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["days"] = days


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/pages/{id}/analytics".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> PageAnalytics | Problem:
    if response.status_code == 200:
        response_200 = PageAnalytics.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[PageAnalytics | Problem]:
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
    days: int | Unset = 30,

) -> Response[PageAnalytics | Problem]:
    """ Views and readers of a page per day

     Counts for everyone who sees the page; the list of readers only for space administrators. Per-person
    data covers the last 90 days.

    Args:
        id (str):
        days (int | Unset):  Default: 30.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PageAnalytics | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
days=days,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    days: int | Unset = 30,

) -> PageAnalytics | Problem | None:
    """ Views and readers of a page per day

     Counts for everyone who sees the page; the list of readers only for space administrators. Per-person
    data covers the last 90 days.

    Args:
        id (str):
        days (int | Unset):  Default: 30.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PageAnalytics | Problem
     """


    return sync_detailed(
        id=id,
client=client,
days=days,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    days: int | Unset = 30,

) -> Response[PageAnalytics | Problem]:
    """ Views and readers of a page per day

     Counts for everyone who sees the page; the list of readers only for space administrators. Per-person
    data covers the last 90 days.

    Args:
        id (str):
        days (int | Unset):  Default: 30.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PageAnalytics | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
days=days,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    days: int | Unset = 30,

) -> PageAnalytics | Problem | None:
    """ Views and readers of a page per day

     Counts for everyone who sees the page; the list of readers only for space administrators. Per-person
    data covers the last 90 days.

    Args:
        id (str):
        days (int | Unset):  Default: 30.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PageAnalytics | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
days=days,

    )).parsed
