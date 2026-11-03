from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.o_auth_app_created import OAuthAppCreated
from ...models.problem import Problem
from ...models.save_o_auth_app_request import SaveOAuthAppRequest
from typing import cast



def _get_kwargs(
    *,
    body: SaveOAuthAppRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/admin/oauth-apps",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> OAuthAppCreated | Problem:
    if response.status_code == 201:
        response_201 = OAuthAppCreated.from_dict(response.json())



        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[OAuthAppCreated | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SaveOAuthAppRequest,

) -> Response[OAuthAppCreated | Problem]:
    """ Register an app for a third party

     Confidential apps get a client secret, shown only in this answer; public apps use PKCE alone. Both
    use the authorization code flow with PKCE.

    Requires the global permission `admin`.

    Args:
        body (SaveOAuthAppRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[OAuthAppCreated | Problem]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: SaveOAuthAppRequest,

) -> OAuthAppCreated | Problem | None:
    """ Register an app for a third party

     Confidential apps get a client secret, shown only in this answer; public apps use PKCE alone. Both
    use the authorization code flow with PKCE.

    Requires the global permission `admin`.

    Args:
        body (SaveOAuthAppRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        OAuthAppCreated | Problem
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SaveOAuthAppRequest,

) -> Response[OAuthAppCreated | Problem]:
    """ Register an app for a third party

     Confidential apps get a client secret, shown only in this answer; public apps use PKCE alone. Both
    use the authorization code flow with PKCE.

    Requires the global permission `admin`.

    Args:
        body (SaveOAuthAppRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[OAuthAppCreated | Problem]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: SaveOAuthAppRequest,

) -> OAuthAppCreated | Problem | None:
    """ Register an app for a third party

     Confidential apps get a client secret, shown only in this answer; public apps use PKCE alone. Both
    use the authorization code flow with PKCE.

    Requires the global permission `admin`.

    Args:
        body (SaveOAuthAppRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        OAuthAppCreated | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
