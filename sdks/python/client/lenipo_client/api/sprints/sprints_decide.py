from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.decide_approval_request import DecideApprovalRequest
from ...models.problem import Problem
from ...models.sprint_approval import SprintApproval
from typing import cast



def _get_kwargs(
    id: str,
    *,
    body: DecideApprovalRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/sprint-approvals/{id}/decision".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | SprintApproval:
    if response.status_code == 200:
        response_200 = SprintApproval.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | SprintApproval]:
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
    body: DecideApprovalRequest,

) -> Response[Problem | SprintApproval]:
    """ Approve or reject an agent’s sprint request

     For people with `edit-issues`. Approving starts or completes the sprint in the agent’s name; the
    agent is notified either way, a rejection with its reason.

    Args:
        id (str):
        body (DecideApprovalRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | SprintApproval]
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
    body: DecideApprovalRequest,

) -> Problem | SprintApproval | None:
    """ Approve or reject an agent’s sprint request

     For people with `edit-issues`. Approving starts or completes the sprint in the agent’s name; the
    agent is notified either way, a rejection with its reason.

    Args:
        id (str):
        body (DecideApprovalRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | SprintApproval
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
    body: DecideApprovalRequest,

) -> Response[Problem | SprintApproval]:
    """ Approve or reject an agent’s sprint request

     For people with `edit-issues`. Approving starts or completes the sprint in the agent’s name; the
    agent is notified either way, a rejection with its reason.

    Args:
        id (str):
        body (DecideApprovalRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | SprintApproval]
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
    body: DecideApprovalRequest,

) -> Problem | SprintApproval | None:
    """ Approve or reject an agent’s sprint request

     For people with `edit-issues`. Approving starts or completes the sprint in the agent’s name; the
    agent is notified either way, a rejection with its reason.

    Args:
        id (str):
        body (DecideApprovalRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | SprintApproval
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
