from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.maintenance_mode import MaintenanceMode
from ...models.maintenance_mode_input import MaintenanceModeInput
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    *,
    body: MaintenanceModeInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/admin/maintenance-mode",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> MaintenanceMode | Problem:
    if response.status_code == 200:
        response_200 = MaintenanceMode.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[MaintenanceMode | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: MaintenanceModeInput,

) -> Response[MaintenanceMode | Problem]:
    """ Switch maintenance mode

     While on, only administrators can sign in and use Lenipo; others see the message.

    Requires the global permission `admin`.

    Args:
        body (MaintenanceModeInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[MaintenanceMode | Problem]
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
    body: MaintenanceModeInput,

) -> MaintenanceMode | Problem | None:
    """ Switch maintenance mode

     While on, only administrators can sign in and use Lenipo; others see the message.

    Requires the global permission `admin`.

    Args:
        body (MaintenanceModeInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        MaintenanceMode | Problem
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: MaintenanceModeInput,

) -> Response[MaintenanceMode | Problem]:
    """ Switch maintenance mode

     While on, only administrators can sign in and use Lenipo; others see the message.

    Requires the global permission `admin`.

    Args:
        body (MaintenanceModeInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[MaintenanceMode | Problem]
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
    body: MaintenanceModeInput,

) -> MaintenanceMode | Problem | None:
    """ Switch maintenance mode

     While on, only administrators can sign in and use Lenipo; others see the message.

    Requires the global permission `admin`.

    Args:
        body (MaintenanceModeInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        MaintenanceMode | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
