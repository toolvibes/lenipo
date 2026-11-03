from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.sprint import Sprint
from ...models.sprint_approval import SprintApproval
from ...models.start_sprint_request import StartSprintRequest
from typing import cast



def _get_kwargs(
    id: str,
    *,
    body: StartSprintRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/sprints/{id}/start".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | Sprint | SprintApproval:
    if response.status_code == 200:
        response_200 = Sprint.from_dict(response.json())



        return response_200

    if response.status_code == 202:
        response_202 = SprintApproval.from_dict(response.json())



        return response_202

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | Sprint | SprintApproval]:
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
    body: StartSprintRequest,

) -> Response[Problem | Sprint | SprintApproval]:
    """ Start a planned sprint

     One sprint runs per board. The estimates at this moment are the commitment. Agents need the role
    planner; where the project wants approval, an agent gets 202 with the waiting request instead, and
    the sprint starts once a person approves it.

    Args:
        id (str):
        body (StartSprintRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | Sprint | SprintApproval]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: StartSprintRequest,

) -> Problem | Sprint | SprintApproval | None:
    """ Start a planned sprint

     One sprint runs per board. The estimates at this moment are the commitment. Agents need the role
    planner; where the project wants approval, an agent gets 202 with the waiting request instead, and
    the sprint starts once a person approves it.

    Args:
        id (str):
        body (StartSprintRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | Sprint | SprintApproval
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: StartSprintRequest,

) -> Response[Problem | Sprint | SprintApproval]:
    """ Start a planned sprint

     One sprint runs per board. The estimates at this moment are the commitment. Agents need the role
    planner; where the project wants approval, an agent gets 202 with the waiting request instead, and
    the sprint starts once a person approves it.

    Args:
        id (str):
        body (StartSprintRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | Sprint | SprintApproval]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: StartSprintRequest,

) -> Problem | Sprint | SprintApproval | None:
    """ Start a planned sprint

     One sprint runs per board. The estimates at this moment are the commitment. Agents need the role
    planner; where the project wants approval, an agent gets 202 with the waiting request instead, and
    the sprint starts once a person approves it.

    Args:
        id (str):
        body (StartSprintRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | Sprint | SprintApproval
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
