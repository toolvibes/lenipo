from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.o_auth_client_info import OAuthClientInfo
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    client_id: str,
    redirect_uri: str,
    scope: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["client_id"] = client_id

    params["redirect_uri"] = redirect_uri

    params["scope"] = scope


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/oauth/client",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> OAuthClientInfo | Problem:
    if response.status_code == 200:
        response_200 = OAuthClientInfo.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[OAuthClientInfo | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    client_id: str,
    redirect_uri: str,
    scope: str | Unset = UNSET,

) -> Response[OAuthClientInfo | Problem]:
    """ Describe a client asking for access

     For the consent page; unknown clients and unregistered redirect URIs answer 404.

    Args:
        client_id (str):
        redirect_uri (str):
        scope (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[OAuthClientInfo | Problem]
     """


    kwargs = _get_kwargs(
        client_id=client_id,
redirect_uri=redirect_uri,
scope=scope,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    client_id: str,
    redirect_uri: str,
    scope: str | Unset = UNSET,

) -> OAuthClientInfo | Problem | None:
    """ Describe a client asking for access

     For the consent page; unknown clients and unregistered redirect URIs answer 404.

    Args:
        client_id (str):
        redirect_uri (str):
        scope (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        OAuthClientInfo | Problem
     """


    return sync_detailed(
        client=client,
client_id=client_id,
redirect_uri=redirect_uri,
scope=scope,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    client_id: str,
    redirect_uri: str,
    scope: str | Unset = UNSET,

) -> Response[OAuthClientInfo | Problem]:
    """ Describe a client asking for access

     For the consent page; unknown clients and unregistered redirect URIs answer 404.

    Args:
        client_id (str):
        redirect_uri (str):
        scope (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[OAuthClientInfo | Problem]
     """


    kwargs = _get_kwargs(
        client_id=client_id,
redirect_uri=redirect_uri,
scope=scope,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    client_id: str,
    redirect_uri: str,
    scope: str | Unset = UNSET,

) -> OAuthClientInfo | Problem | None:
    """ Describe a client asking for access

     For the consent page; unknown clients and unregistered redirect URIs answer 404.

    Args:
        client_id (str):
        redirect_uri (str):
        scope (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        OAuthClientInfo | Problem
     """


    return (await asyncio_detailed(
        client=client,
client_id=client_id,
redirect_uri=redirect_uri,
scope=scope,

    )).parsed
