from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.activity_page import ActivityPage
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID
import datetime



def _get_kwargs(
    *,
    project: str | Unset = UNSET,
    user: UUID | Unset = UNSET,
    before: datetime.datetime | Unset = UNSET,
    limit: int | Unset = 30,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["project"] = project

    json_user: str | Unset = UNSET
    if not isinstance(user, Unset):
        json_user = str(user)
    params["user"] = json_user

    json_before: str | Unset = UNSET
    if not isinstance(before, Unset):
        json_before = before.isoformat()
    params["before"] = json_before

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/activity",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ActivityPage | Problem:
    if response.status_code == 200:
        response_200 = ActivityPage.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ActivityPage | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    project: str | Unset = UNSET,
    user: UUID | Unset = UNSET,
    before: datetime.datetime | Unset = UNSET,
    limit: int | Unset = 30,

) -> Response[ActivityPage | Problem]:
    """ Activity stream: new issues, changes and comments, newest first

     Optionally for one project or one person; page with `before` = `next`.

    Args:
        project (str | Unset):
        user (UUID | Unset):
        before (datetime.datetime | Unset):
        limit (int | Unset):  Default: 30.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ActivityPage | Problem]
     """


    kwargs = _get_kwargs(
        project=project,
user=user,
before=before,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    project: str | Unset = UNSET,
    user: UUID | Unset = UNSET,
    before: datetime.datetime | Unset = UNSET,
    limit: int | Unset = 30,

) -> ActivityPage | Problem | None:
    """ Activity stream: new issues, changes and comments, newest first

     Optionally for one project or one person; page with `before` = `next`.

    Args:
        project (str | Unset):
        user (UUID | Unset):
        before (datetime.datetime | Unset):
        limit (int | Unset):  Default: 30.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ActivityPage | Problem
     """


    return sync_detailed(
        client=client,
project=project,
user=user,
before=before,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    project: str | Unset = UNSET,
    user: UUID | Unset = UNSET,
    before: datetime.datetime | Unset = UNSET,
    limit: int | Unset = 30,

) -> Response[ActivityPage | Problem]:
    """ Activity stream: new issues, changes and comments, newest first

     Optionally for one project or one person; page with `before` = `next`.

    Args:
        project (str | Unset):
        user (UUID | Unset):
        before (datetime.datetime | Unset):
        limit (int | Unset):  Default: 30.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ActivityPage | Problem]
     """


    kwargs = _get_kwargs(
        project=project,
user=user,
before=before,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    project: str | Unset = UNSET,
    user: UUID | Unset = UNSET,
    before: datetime.datetime | Unset = UNSET,
    limit: int | Unset = 30,

) -> ActivityPage | Problem | None:
    """ Activity stream: new issues, changes and comments, newest first

     Optionally for one project or one person; page with `before` = `next`.

    Args:
        project (str | Unset):
        user (UUID | Unset):
        before (datetime.datetime | Unset):
        limit (int | Unset):  Default: 30.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ActivityPage | Problem
     """


    return (await asyncio_detailed(
        client=client,
project=project,
user=user,
before=before,
limit=limit,

    )).parsed
