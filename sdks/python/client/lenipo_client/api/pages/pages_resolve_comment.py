from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.page_comment import PageComment
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    id: str,
    comment_id: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/pages/{id}/comments/{comment_id}/resolved".format(id=quote(str(id), safe=""),comment_id=quote(str(comment_id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> PageComment | Problem:
    if response.status_code == 200:
        response_200 = PageComment.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[PageComment | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    comment_id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[PageComment | Problem]:
    """ Resolve an inline thread

    Args:
        id (str):
        comment_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PageComment | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
comment_id=comment_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    comment_id: str,
    *,
    client: AuthenticatedClient | Client,

) -> PageComment | Problem | None:
    """ Resolve an inline thread

    Args:
        id (str):
        comment_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PageComment | Problem
     """


    return sync_detailed(
        id=id,
comment_id=comment_id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: str,
    comment_id: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[PageComment | Problem]:
    """ Resolve an inline thread

    Args:
        id (str):
        comment_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PageComment | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
comment_id=comment_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    comment_id: str,
    *,
    client: AuthenticatedClient | Client,

) -> PageComment | Problem | None:
    """ Resolve an inline thread

    Args:
        id (str):
        comment_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PageComment | Problem
     """


    return (await asyncio_detailed(
        id=id,
comment_id=comment_id,
client=client,

    )).parsed
