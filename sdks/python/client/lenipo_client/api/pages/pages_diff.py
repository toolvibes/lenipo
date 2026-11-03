from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.page_diff import PageDiff
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    id: str,
    *,
    from_: int,
    to: int,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["from"] = from_

    params["to"] = to


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/pages/{id}/diff".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> PageDiff | Problem:
    if response.status_code == 200:
        response_200 = PageDiff.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[PageDiff | Problem]:
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
    from_: int,
    to: int,

) -> Response[PageDiff | Problem]:
    """ Compare two published versions of a page

     Blocks (headings, paragraphs, list and task items, table rows, images, …) of `to` against `from`:
    unchanged, added, removed, or changed with the changed words.

    Args:
        id (str):
        from_ (int):
        to (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PageDiff | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
from_=from_,
to=to,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    from_: int,
    to: int,

) -> PageDiff | Problem | None:
    """ Compare two published versions of a page

     Blocks (headings, paragraphs, list and task items, table rows, images, …) of `to` against `from`:
    unchanged, added, removed, or changed with the changed words.

    Args:
        id (str):
        from_ (int):
        to (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PageDiff | Problem
     """


    return sync_detailed(
        id=id,
client=client,
from_=from_,
to=to,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    from_: int,
    to: int,

) -> Response[PageDiff | Problem]:
    """ Compare two published versions of a page

     Blocks (headings, paragraphs, list and task items, table rows, images, …) of `to` against `from`:
    unchanged, added, removed, or changed with the changed words.

    Args:
        id (str):
        from_ (int):
        to (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PageDiff | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
from_=from_,
to=to,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    from_: int,
    to: int,

) -> PageDiff | Problem | None:
    """ Compare two published versions of a page

     Blocks (headings, paragraphs, list and task items, table rows, images, …) of `to` against `from`:
    unchanged, added, removed, or changed with the changed words.

    Args:
        id (str):
        from_ (int):
        to (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PageDiff | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
from_=from_,
to=to,

    )).parsed
