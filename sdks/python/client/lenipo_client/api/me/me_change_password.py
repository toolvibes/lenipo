from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.change_password_request import ChangePasswordRequest
from ...models.password_changed import PasswordChanged
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    *,
    body: ChangePasswordRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/me/password",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> PasswordChanged | Problem:
    if response.status_code == 200:
        response_200 = PasswordChanged.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[PasswordChanged | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ChangePasswordRequest,

) -> Response[PasswordChanged | Problem]:
    """ Change the own password; other sessions end

     Needs the current password and a browser session. Failures count against the same limit as the login
    (429 when exceeded); accounts without a local password get 409. Personal access tokens stay valid.

    Args:
        body (ChangePasswordRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PasswordChanged | Problem]
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
    body: ChangePasswordRequest,

) -> PasswordChanged | Problem | None:
    """ Change the own password; other sessions end

     Needs the current password and a browser session. Failures count against the same limit as the login
    (429 when exceeded); accounts without a local password get 409. Personal access tokens stay valid.

    Args:
        body (ChangePasswordRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PasswordChanged | Problem
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ChangePasswordRequest,

) -> Response[PasswordChanged | Problem]:
    """ Change the own password; other sessions end

     Needs the current password and a browser session. Failures count against the same limit as the login
    (429 when exceeded); accounts without a local password get 409. Personal access tokens stay valid.

    Args:
        body (ChangePasswordRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PasswordChanged | Problem]
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
    body: ChangePasswordRequest,

) -> PasswordChanged | Problem | None:
    """ Change the own password; other sessions end

     Needs the current password and a browser session. Failures count against the same limit as the login
    (429 when exceeded); accounts without a local password get 409. Personal access tokens stay valid.

    Args:
        body (ChangePasswordRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PasswordChanged | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
