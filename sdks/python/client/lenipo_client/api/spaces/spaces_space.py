from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.spaces_space_locale import SpacesSpaceLocale
from ...types import File, FileTypes
from ...types import UNSET, Unset
from io import BytesIO
from typing import cast



def _get_kwargs(
    key: str,
    format_: str,
    *,
    locale: SpacesSpaceLocale | Unset = SpacesSpaceLocale.DE,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_locale: str | Unset = UNSET
    if not isinstance(locale, Unset):
        json_locale = locale.value

    params["locale"] = json_locale


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/spaces/{key}/export/{format_}".format(key=quote(str(key), safe=""),format_=quote(str(format_), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> File | Problem:
    if response.status_code == 200:
        response_200 = File(
             payload = BytesIO(response.content)
        )



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[File | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    format_: str,
    *,
    client: AuthenticatedClient | Client,
    locale: SpacesSpaceLocale | Unset = SpacesSpaceLocale.DE,

) -> Response[File | Problem]:
    """ Export a space

     A ZIP with every published page the caller can read as Markdown or HTML files in the page tree’s
    folders, plus their attachments (at most 2,000 pages).

    Args:
        key (str):
        format_ (str):
        locale (SpacesSpaceLocale | Unset):  Default: SpacesSpaceLocale.DE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[File | Problem]
     """


    kwargs = _get_kwargs(
        key=key,
format_=format_,
locale=locale,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    format_: str,
    *,
    client: AuthenticatedClient | Client,
    locale: SpacesSpaceLocale | Unset = SpacesSpaceLocale.DE,

) -> File | Problem | None:
    """ Export a space

     A ZIP with every published page the caller can read as Markdown or HTML files in the page tree’s
    folders, plus their attachments (at most 2,000 pages).

    Args:
        key (str):
        format_ (str):
        locale (SpacesSpaceLocale | Unset):  Default: SpacesSpaceLocale.DE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        File | Problem
     """


    return sync_detailed(
        key=key,
format_=format_,
client=client,
locale=locale,

    ).parsed

async def asyncio_detailed(
    key: str,
    format_: str,
    *,
    client: AuthenticatedClient | Client,
    locale: SpacesSpaceLocale | Unset = SpacesSpaceLocale.DE,

) -> Response[File | Problem]:
    """ Export a space

     A ZIP with every published page the caller can read as Markdown or HTML files in the page tree’s
    folders, plus their attachments (at most 2,000 pages).

    Args:
        key (str):
        format_ (str):
        locale (SpacesSpaceLocale | Unset):  Default: SpacesSpaceLocale.DE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[File | Problem]
     """


    kwargs = _get_kwargs(
        key=key,
format_=format_,
locale=locale,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    format_: str,
    *,
    client: AuthenticatedClient | Client,
    locale: SpacesSpaceLocale | Unset = SpacesSpaceLocale.DE,

) -> File | Problem | None:
    """ Export a space

     A ZIP with every published page the caller can read as Markdown or HTML files in the page tree’s
    folders, plus their attachments (at most 2,000 pages).

    Args:
        key (str):
        format_ (str):
        locale (SpacesSpaceLocale | Unset):  Default: SpacesSpaceLocale.DE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        File | Problem
     """


    return (await asyncio_detailed(
        key=key,
format_=format_,
client=client,
locale=locale,

    )).parsed
