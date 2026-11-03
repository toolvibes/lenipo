from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.pages_page_children import PagesPageChildren
from ...models.pages_page_locale import PagesPageLocale
from ...models.problem import Problem
from ...types import File, FileTypes
from ...types import UNSET, Unset
from io import BytesIO
from typing import cast



def _get_kwargs(
    id: str,
    format_: str,
    *,
    children: PagesPageChildren | Unset = PagesPageChildren.FALSE,
    locale: PagesPageLocale | Unset = PagesPageLocale.DE,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_children: str | Unset = UNSET
    if not isinstance(children, Unset):
        json_children = children.value

    params["children"] = json_children

    json_locale: str | Unset = UNSET
    if not isinstance(locale, Unset):
        json_locale = locale.value

    params["locale"] = json_locale


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/pages/{id}/export/{format_}".format(id=quote(str(id), safe=""),format_=quote(str(format_), safe=""),),
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
    id: str,
    format_: str,
    *,
    client: AuthenticatedClient | Client,
    children: PagesPageChildren | Unset = PagesPageChildren.FALSE,
    locale: PagesPageLocale | Unset = PagesPageLocale.DE,

) -> Response[File | Problem]:
    """ Export a page

     `docx` is a Word document with header, footer and, with child pages, a table of contents; `markdown`
    a ZIP with the page as Markdown and its attachments; `html` one self-contained HTML file.
    `children=true` adds the published child pages (at most 200). Only published pages can be exported;
    whoever may read a page may export it.

    Args:
        id (str):
        format_ (str):
        children (PagesPageChildren | Unset):  Default: PagesPageChildren.FALSE.
        locale (PagesPageLocale | Unset):  Default: PagesPageLocale.DE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[File | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
format_=format_,
children=children,
locale=locale,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    format_: str,
    *,
    client: AuthenticatedClient | Client,
    children: PagesPageChildren | Unset = PagesPageChildren.FALSE,
    locale: PagesPageLocale | Unset = PagesPageLocale.DE,

) -> File | Problem | None:
    """ Export a page

     `docx` is a Word document with header, footer and, with child pages, a table of contents; `markdown`
    a ZIP with the page as Markdown and its attachments; `html` one self-contained HTML file.
    `children=true` adds the published child pages (at most 200). Only published pages can be exported;
    whoever may read a page may export it.

    Args:
        id (str):
        format_ (str):
        children (PagesPageChildren | Unset):  Default: PagesPageChildren.FALSE.
        locale (PagesPageLocale | Unset):  Default: PagesPageLocale.DE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        File | Problem
     """


    return sync_detailed(
        id=id,
format_=format_,
client=client,
children=children,
locale=locale,

    ).parsed

async def asyncio_detailed(
    id: str,
    format_: str,
    *,
    client: AuthenticatedClient | Client,
    children: PagesPageChildren | Unset = PagesPageChildren.FALSE,
    locale: PagesPageLocale | Unset = PagesPageLocale.DE,

) -> Response[File | Problem]:
    """ Export a page

     `docx` is a Word document with header, footer and, with child pages, a table of contents; `markdown`
    a ZIP with the page as Markdown and its attachments; `html` one self-contained HTML file.
    `children=true` adds the published child pages (at most 200). Only published pages can be exported;
    whoever may read a page may export it.

    Args:
        id (str):
        format_ (str):
        children (PagesPageChildren | Unset):  Default: PagesPageChildren.FALSE.
        locale (PagesPageLocale | Unset):  Default: PagesPageLocale.DE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[File | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
format_=format_,
children=children,
locale=locale,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    format_: str,
    *,
    client: AuthenticatedClient | Client,
    children: PagesPageChildren | Unset = PagesPageChildren.FALSE,
    locale: PagesPageLocale | Unset = PagesPageLocale.DE,

) -> File | Problem | None:
    """ Export a page

     `docx` is a Word document with header, footer and, with child pages, a table of contents; `markdown`
    a ZIP with the page as Markdown and its attachments; `html` one self-contained HTML file.
    `children=true` adds the published child pages (at most 200). Only published pages can be exported;
    whoever may read a page may export it.

    Args:
        id (str):
        format_ (str):
        children (PagesPageChildren | Unset):  Default: PagesPageChildren.FALSE.
        locale (PagesPageLocale | Unset):  Default: PagesPageLocale.DE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        File | Problem
     """


    return (await asyncio_detailed(
        id=id,
format_=format_,
client=client,
children=children,
locale=locale,

    )).parsed
