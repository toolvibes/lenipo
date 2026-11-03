from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_permission_scheme_request import CreatePermissionSchemeRequest
from ...models.permission_scheme import PermissionScheme
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    *,
    body: CreatePermissionSchemeRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/admin/permission-schemes",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> PermissionScheme | Problem:
    if response.status_code == 201:
        response_201 = PermissionScheme.from_dict(response.json())



        return response_201

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[PermissionScheme | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreatePermissionSchemeRequest,

) -> Response[PermissionScheme | Problem]:
    """ Create a permission scheme as a copy of another (the default one if not given)

     Requires the global permission `admin`.

    Args:
        body (CreatePermissionSchemeRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PermissionScheme | Problem]
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
    body: CreatePermissionSchemeRequest,

) -> PermissionScheme | Problem | None:
    """ Create a permission scheme as a copy of another (the default one if not given)

     Requires the global permission `admin`.

    Args:
        body (CreatePermissionSchemeRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PermissionScheme | Problem
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreatePermissionSchemeRequest,

) -> Response[PermissionScheme | Problem]:
    """ Create a permission scheme as a copy of another (the default one if not given)

     Requires the global permission `admin`.

    Args:
        body (CreatePermissionSchemeRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PermissionScheme | Problem]
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
    body: CreatePermissionSchemeRequest,

) -> PermissionScheme | Problem | None:
    """ Create a permission scheme as a copy of another (the default one if not given)

     Requires the global permission `admin`.

    Args:
        body (CreatePermissionSchemeRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PermissionScheme | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
