from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.page_version import PageVersion
from ...models.pages_version_format import PagesVersionFormat
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    id: str,
    number: str,
    *,
    format_: PagesVersionFormat | Unset = PagesVersionFormat.JSON,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_format_: str | Unset = UNSET
    if not isinstance(format_, Unset):
        json_format_ = format_.value

    params["format"] = json_format_


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/pages/{id}/versions/{number}".format(id=quote(str(id), safe=""),number=quote(str(number), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> PageVersion | Problem:
    if response.status_code == 200:
        response_200 = PageVersion.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[PageVersion | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    number: str,
    *,
    client: AuthenticatedClient | Client,
    format_: PagesVersionFormat | Unset = PagesVersionFormat.JSON,

) -> Response[PageVersion | Problem]:
    """ One published version of a page

    Args:
        id (str):
        number (str):
        format_ (PagesVersionFormat | Unset):  Default: PagesVersionFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PageVersion | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
number=number,
format_=format_,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    number: str,
    *,
    client: AuthenticatedClient | Client,
    format_: PagesVersionFormat | Unset = PagesVersionFormat.JSON,

) -> PageVersion | Problem | None:
    """ One published version of a page

    Args:
        id (str):
        number (str):
        format_ (PagesVersionFormat | Unset):  Default: PagesVersionFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PageVersion | Problem
     """


    return sync_detailed(
        id=id,
number=number,
client=client,
format_=format_,

    ).parsed

async def asyncio_detailed(
    id: str,
    number: str,
    *,
    client: AuthenticatedClient | Client,
    format_: PagesVersionFormat | Unset = PagesVersionFormat.JSON,

) -> Response[PageVersion | Problem]:
    """ One published version of a page

    Args:
        id (str):
        number (str):
        format_ (PagesVersionFormat | Unset):  Default: PagesVersionFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PageVersion | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
number=number,
format_=format_,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    number: str,
    *,
    client: AuthenticatedClient | Client,
    format_: PagesVersionFormat | Unset = PagesVersionFormat.JSON,

) -> PageVersion | Problem | None:
    """ One published version of a page

    Args:
        id (str):
        number (str):
        format_ (PagesVersionFormat | Unset):  Default: PagesVersionFormat.JSON.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PageVersion | Problem
     """


    return (await asyncio_detailed(
        id=id,
number=number,
client=client,
format_=format_,

    )).parsed
