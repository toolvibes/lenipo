from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.pages_get_format import PagesGetFormat
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    id: str,
    *,
    format_: PagesGetFormat | Unset = PagesGetFormat.JSON,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/pages/{id}".format(id=quote(str(id), safe=""),),
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
    format_: PagesGetFormat | Unset = PagesGetFormat.JSON,

) -> Response[Problem]:
    """ Get a page: its latest published version

     Drafts have `version` 0 and no content. `?format=markdown` returns the content as Markdown.

    Args:
        id (str):
        format_ (PagesGetFormat | Unset):  Default: PagesGetFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem]
     """


    kwargs = _get_kwargs(
        id=id,
format_=format_,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: PagesGetFormat | Unset = PagesGetFormat.JSON,

) -> Problem | None:
    """ Get a page: its latest published version

     Drafts have `version` 0 and no content. `?format=markdown` returns the content as Markdown.

    Args:
        id (str):
        format_ (PagesGetFormat | Unset):  Default: PagesGetFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem
     """


    return sync_detailed(
        id=id,
client=client,
format_=format_,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: PagesGetFormat | Unset = PagesGetFormat.JSON,

) -> Response[Problem]:
    """ Get a page: its latest published version

     Drafts have `version` 0 and no content. `?format=markdown` returns the content as Markdown.

    Args:
        id (str):
        format_ (PagesGetFormat | Unset):  Default: PagesGetFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem]
     """


    kwargs = _get_kwargs(
        id=id,
format_=format_,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    format_: PagesGetFormat | Unset = PagesGetFormat.JSON,

) -> Problem | None:
    """ Get a page: its latest published version

     Drafts have `version` 0 and no content. `?format=markdown` returns the content as Markdown.

    Args:
        id (str):
        format_ (PagesGetFormat | Unset):  Default: PagesGetFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
format_=format_,

    )).parsed
