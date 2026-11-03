from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.everything_result import EverythingResult
from ...models.problem import Problem
from ...models.search_search_everything_type import SearchSearchEverythingType
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    q: str,
    type_: SearchSearchEverythingType | Unset = UNSET,
    project: str | Unset = UNSET,
    limit: int | Unset = 10,
    semantic: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["q"] = q

    json_type_: str | Unset = UNSET
    if not isinstance(type_, Unset):
        json_type_ = type_.value

    params["type"] = json_type_

    params["project"] = project

    params["limit"] = limit

    params["semantic"] = semantic


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/search/everything",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> EverythingResult | Problem:
    if response.status_code == 200:
        response_200 = EverythingResult.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[EverythingResult | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    q: str,
    type_: SearchSearchEverythingType | Unset = UNSET,
    project: str | Unset = UNSET,
    limit: int | Unset = 10,
    semantic: str | Unset = UNSET,

) -> Response[EverythingResult | Problem]:
    """ Search issues, wiki pages, projects and spaces

     Full text in German and English over what the caller may see; the last word also matches as a
    prefix, quotes, OR and -word work as in web search. Pages are searched in their latest published
    version, with a snippet whose hits are marked. `counts` always cover every kind.

    Args:
        q (str):
        type_ (SearchSearchEverythingType | Unset):
        project (str | Unset):
        limit (int | Unset):  Default: 10.
        semantic (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[EverythingResult | Problem]
     """


    kwargs = _get_kwargs(
        q=q,
type_=type_,
project=project,
limit=limit,
semantic=semantic,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    q: str,
    type_: SearchSearchEverythingType | Unset = UNSET,
    project: str | Unset = UNSET,
    limit: int | Unset = 10,
    semantic: str | Unset = UNSET,

) -> EverythingResult | Problem | None:
    """ Search issues, wiki pages, projects and spaces

     Full text in German and English over what the caller may see; the last word also matches as a
    prefix, quotes, OR and -word work as in web search. Pages are searched in their latest published
    version, with a snippet whose hits are marked. `counts` always cover every kind.

    Args:
        q (str):
        type_ (SearchSearchEverythingType | Unset):
        project (str | Unset):
        limit (int | Unset):  Default: 10.
        semantic (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        EverythingResult | Problem
     """


    return sync_detailed(
        client=client,
q=q,
type_=type_,
project=project,
limit=limit,
semantic=semantic,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    q: str,
    type_: SearchSearchEverythingType | Unset = UNSET,
    project: str | Unset = UNSET,
    limit: int | Unset = 10,
    semantic: str | Unset = UNSET,

) -> Response[EverythingResult | Problem]:
    """ Search issues, wiki pages, projects and spaces

     Full text in German and English over what the caller may see; the last word also matches as a
    prefix, quotes, OR and -word work as in web search. Pages are searched in their latest published
    version, with a snippet whose hits are marked. `counts` always cover every kind.

    Args:
        q (str):
        type_ (SearchSearchEverythingType | Unset):
        project (str | Unset):
        limit (int | Unset):  Default: 10.
        semantic (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[EverythingResult | Problem]
     """


    kwargs = _get_kwargs(
        q=q,
type_=type_,
project=project,
limit=limit,
semantic=semantic,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    q: str,
    type_: SearchSearchEverythingType | Unset = UNSET,
    project: str | Unset = UNSET,
    limit: int | Unset = 10,
    semantic: str | Unset = UNSET,

) -> EverythingResult | Problem | None:
    """ Search issues, wiki pages, projects and spaces

     Full text in German and English over what the caller may see; the last word also matches as a
    prefix, quotes, OR and -word work as in web search. Pages are searched in their latest published
    version, with a snippet whose hits are marked. `counts` always cover every kind.

    Args:
        q (str):
        type_ (SearchSearchEverythingType | Unset):
        project (str | Unset):
        limit (int | Unset):  Default: 10.
        semantic (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        EverythingResult | Problem
     """


    return (await asyncio_detailed(
        client=client,
q=q,
type_=type_,
project=project,
limit=limit,
semantic=semantic,

    )).parsed
