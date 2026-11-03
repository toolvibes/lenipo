from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.agent_activity_page import AgentActivityPage
from ...models.problem import Problem
from ...types import UNSET, Unset
from typing import cast
import datetime



def _get_kwargs(
    id: str,
    *,
    before: datetime.datetime | Unset = UNSET,
    limit: int | Unset = 50,
    failures: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_before: str | Unset = UNSET
    if not isinstance(before, Unset):
        json_before = before.isoformat()
    params["before"] = json_before

    params["limit"] = limit

    params["failures"] = failures


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/agents/{id}/activity".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> AgentActivityPage | Problem:
    if response.status_code == 200:
        response_200 = AgentActivityPage.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[AgentActivityPage | Problem]:
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
    before: datetime.datetime | Unset = UNSET,
    limit: int | Unset = 50,
    failures: str | Unset = UNSET,

) -> Response[AgentActivityPage | Problem]:
    """ Get the history of an AI agent

     Its writing and rejected requests (kept 90 days), changes, comments, reviews and approval requests,
    newest first; changes and comments only on issues the caller can see.

    Args:
        id (str):
        before (datetime.datetime | Unset):
        limit (int | Unset):  Default: 50.
        failures (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AgentActivityPage | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
before=before,
limit=limit,
failures=failures,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    before: datetime.datetime | Unset = UNSET,
    limit: int | Unset = 50,
    failures: str | Unset = UNSET,

) -> AgentActivityPage | Problem | None:
    """ Get the history of an AI agent

     Its writing and rejected requests (kept 90 days), changes, comments, reviews and approval requests,
    newest first; changes and comments only on issues the caller can see.

    Args:
        id (str):
        before (datetime.datetime | Unset):
        limit (int | Unset):  Default: 50.
        failures (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AgentActivityPage | Problem
     """


    return sync_detailed(
        id=id,
client=client,
before=before,
limit=limit,
failures=failures,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    before: datetime.datetime | Unset = UNSET,
    limit: int | Unset = 50,
    failures: str | Unset = UNSET,

) -> Response[AgentActivityPage | Problem]:
    """ Get the history of an AI agent

     Its writing and rejected requests (kept 90 days), changes, comments, reviews and approval requests,
    newest first; changes and comments only on issues the caller can see.

    Args:
        id (str):
        before (datetime.datetime | Unset):
        limit (int | Unset):  Default: 50.
        failures (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AgentActivityPage | Problem]
     """


    kwargs = _get_kwargs(
        id=id,
before=before,
limit=limit,
failures=failures,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    before: datetime.datetime | Unset = UNSET,
    limit: int | Unset = 50,
    failures: str | Unset = UNSET,

) -> AgentActivityPage | Problem | None:
    """ Get the history of an AI agent

     Its writing and rejected requests (kept 90 days), changes, comments, reviews and approval requests,
    newest first; changes and comments only on issues the caller can see.

    Args:
        id (str):
        before (datetime.datetime | Unset):
        limit (int | Unset):  Default: 50.
        failures (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AgentActivityPage | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
before=before,
limit=limit,
failures=failures,

    )).parsed
