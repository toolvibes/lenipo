from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.timesheet import Timesheet
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID
import datetime



def _get_kwargs(
    *,
    user: UUID | Unset = UNSET,
    week: datetime.date | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_user: str | Unset = UNSET
    if not isinstance(user, Unset):
        json_user = str(user)
    params["user"] = json_user

    json_week: str | Unset = UNSET
    if not isinstance(week, Unset):
        json_week = week.isoformat()
    params["week"] = json_week


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/timesheet",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | Timesheet:
    if response.status_code == 200:
        response_200 = Timesheet.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | Timesheet]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    user: UUID | Unset = UNSET,
    week: datetime.date | Unset = UNSET,

) -> Response[Problem | Timesheet]:
    """ A person's logged time for one week, by issue and day

    Args:
        user (UUID | Unset):
        week (datetime.date | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | Timesheet]
     """


    kwargs = _get_kwargs(
        user=user,
week=week,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    user: UUID | Unset = UNSET,
    week: datetime.date | Unset = UNSET,

) -> Problem | Timesheet | None:
    """ A person's logged time for one week, by issue and day

    Args:
        user (UUID | Unset):
        week (datetime.date | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | Timesheet
     """


    return sync_detailed(
        client=client,
user=user,
week=week,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    user: UUID | Unset = UNSET,
    week: datetime.date | Unset = UNSET,

) -> Response[Problem | Timesheet]:
    """ A person's logged time for one week, by issue and day

    Args:
        user (UUID | Unset):
        week (datetime.date | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | Timesheet]
     """


    kwargs = _get_kwargs(
        user=user,
week=week,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    user: UUID | Unset = UNSET,
    week: datetime.date | Unset = UNSET,

) -> Problem | Timesheet | None:
    """ A person's logged time for one week, by issue and day

    Args:
        user (UUID | Unset):
        week (datetime.date | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | Timesheet
     """


    return (await asyncio_detailed(
        client=client,
user=user,
week=week,

    )).parsed
