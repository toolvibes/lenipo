from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.plan_view import PlanView
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: str,
    *,
    scenario: UUID | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_scenario: str | Unset = UNSET
    if not isinstance(scenario, Unset):
        json_scenario = str(scenario)
    params["scenario"] = json_scenario


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/plans/{id}/view".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> PlanView | Problem:
    if response.status_code == 200:
        response_200 = PlanView.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[PlanView | Problem]:
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
    scenario: UUID | Unset = UNSET,

) -> Response[PlanView | Problem]:
    """ The plan: epics of its projects, capacity, scenarios; optionally as a scenario

    Args:
        id (str):
        scenario (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PlanView | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
scenario=scenario,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    scenario: UUID | Unset = UNSET,

) -> PlanView | Problem | None:
    """ The plan: epics of its projects, capacity, scenarios; optionally as a scenario

    Args:
        id (str):
        scenario (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PlanView | Problem
     """


    return sync_detailed(
        id=id,
client=client,
scenario=scenario,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    scenario: UUID | Unset = UNSET,

) -> Response[PlanView | Problem]:
    """ The plan: epics of its projects, capacity, scenarios; optionally as a scenario

    Args:
        id (str):
        scenario (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[PlanView | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
scenario=scenario,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    scenario: UUID | Unset = UNSET,

) -> PlanView | Problem | None:
    """ The plan: epics of its projects, capacity, scenarios; optionally as a scenario

    Args:
        id (str):
        scenario (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        PlanView | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
scenario=scenario,

    )).parsed
