from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_page_comment_request import CreatePageCommentRequest
from ...models.page_comment import PageComment
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    id: str,
    *,
    body: CreatePageCommentRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/pages/{id}/comments".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> PageComment | Problem:
    if response.status_code == 201:
        response_201 = PageComment.from_dict(response.json())



        return response_201

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
    *,
    client: AuthenticatedClient | Client,
    body: CreatePageCommentRequest,

) -> Response[PageComment | Problem]:
    """ Comment on a page, answer a thread or start an inline thread

     Requires the space permission `comment`. `body` is a document or `{ markdown }`.

    Args:
        id (str):
        body (CreatePageCommentRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PageComment | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: CreatePageCommentRequest,

) -> PageComment | Problem | None:
    """ Comment on a page, answer a thread or start an inline thread

     Requires the space permission `comment`. `body` is a document or `{ markdown }`.

    Args:
        id (str):
        body (CreatePageCommentRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PageComment | Problem
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: CreatePageCommentRequest,

) -> Response[PageComment | Problem]:
    """ Comment on a page, answer a thread or start an inline thread

     Requires the space permission `comment`. `body` is a document or `{ markdown }`.

    Args:
        id (str):
        body (CreatePageCommentRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PageComment | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: CreatePageCommentRequest,

) -> PageComment | Problem | None:
    """ Comment on a page, answer a thread or start an inline thread

     Requires the space permission `comment`. `body` is a document or `{ markdown }`.

    Args:
        id (str):
        body (CreatePageCommentRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PageComment | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
