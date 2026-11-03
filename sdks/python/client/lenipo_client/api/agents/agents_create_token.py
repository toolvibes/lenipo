from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_token_request import CreateTokenRequest
from ...models.created_token import CreatedToken
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    id: str,
    *,
    body: CreateTokenRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/agents/{id}/tokens".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreatedToken | Problem:
    if response.status_code == 201:
        response_201 = CreatedToken.from_dict(response.json())



        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreatedToken | Problem]:
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
    body: CreateTokenRequest,

) -> Response[CreatedToken | Problem]:
    """ Create a token for an AI agent; the secret is returned only once

     Needs a browser session of its responsible person or an administrator. Agent tokens never carry the
    `admin` scope.

    Args:
        id (str):
        body (CreateTokenRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreatedToken | Problem]
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
    body: CreateTokenRequest,

) -> CreatedToken | Problem | None:
    """ Create a token for an AI agent; the secret is returned only once

     Needs a browser session of its responsible person or an administrator. Agent tokens never carry the
    `admin` scope.

    Args:
        id (str):
        body (CreateTokenRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreatedToken | Problem
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
    body: CreateTokenRequest,

) -> Response[CreatedToken | Problem]:
    """ Create a token for an AI agent; the secret is returned only once

     Needs a browser session of its responsible person or an administrator. Agent tokens never carry the
    `admin` scope.

    Args:
        id (str):
        body (CreateTokenRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreatedToken | Problem]
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
    body: CreateTokenRequest,

) -> CreatedToken | Problem | None:
    """ Create a token for an AI agent; the secret is returned only once

     Needs a browser session of its responsible person or an administrator. Agent tokens never carry the
    `admin` scope.

    Args:
        id (str):
        body (CreateTokenRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreatedToken | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
