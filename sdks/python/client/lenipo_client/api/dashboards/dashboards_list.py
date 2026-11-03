from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.dashboard_summary import DashboardSummary
from ...models.dashboards_list_scope import DashboardsListScope
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    scope: DashboardsListScope | Unset = DashboardsListScope.VISIBLE,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_scope: str | Unset = UNSET
    if not isinstance(scope, Unset):
        json_scope = scope.value

    params["scope"] = json_scope


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/dashboards",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | list[DashboardSummary]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in (_response_200):
            response_200_item = DashboardSummary.from_dict(response_200_item_data)



            response_200.append(response_200_item)

        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | list[DashboardSummary]]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    scope: DashboardsListScope | Unset = DashboardsListScope.VISIBLE,

) -> Response[Problem | list[DashboardSummary]]:
    """ List dashboards the caller can see

    Args:
        scope (DashboardsListScope | Unset):  Default: DashboardsListScope.VISIBLE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[DashboardSummary]]
     """


    kwargs = _get_kwargs(
        scope=scope,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    scope: DashboardsListScope | Unset = DashboardsListScope.VISIBLE,

) -> Problem | list[DashboardSummary] | None:
    """ List dashboards the caller can see

    Args:
        scope (DashboardsListScope | Unset):  Default: DashboardsListScope.VISIBLE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[DashboardSummary]
     """


    return sync_detailed(
        client=client,
scope=scope,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    scope: DashboardsListScope | Unset = DashboardsListScope.VISIBLE,

) -> Response[Problem | list[DashboardSummary]]:
    """ List dashboards the caller can see

    Args:
        scope (DashboardsListScope | Unset):  Default: DashboardsListScope.VISIBLE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[DashboardSummary]]
     """


    kwargs = _get_kwargs(
        scope=scope,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    scope: DashboardsListScope | Unset = DashboardsListScope.VISIBLE,

) -> Problem | list[DashboardSummary] | None:
    """ List dashboards the caller can see

    Args:
        scope (DashboardsListScope | Unset):  Default: DashboardsListScope.VISIBLE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[DashboardSummary]
     """


    return (await asyncio_detailed(
        client=client,
scope=scope,

    )).parsed
