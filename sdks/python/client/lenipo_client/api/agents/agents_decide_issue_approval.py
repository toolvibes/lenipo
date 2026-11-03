from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.decide_approval_request import DecideApprovalRequest
from ...models.issue_approval import IssueApproval
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    id: str,
    *,
    body: DecideApprovalRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/issue-approvals/{id}/decision".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> IssueApproval | Problem:
    if response.status_code == 200:
        response_200 = IssueApproval.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[IssueApproval | Problem]:
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

) -> Response[IssueApproval | Problem]:
    """ Approve or reject a transition an agent asked for

     For people who may move issues in the project. Approving moves the issue in the agent’s name;
    rejecting needs a reason, which the agent is told.

    Args:
        id (str):
        body (DecideApprovalRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[IssueApproval | Problem]
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

) -> IssueApproval | Problem | None:
    """ Approve or reject a transition an agent asked for

     For people who may move issues in the project. Approving moves the issue in the agent’s name;
    rejecting needs a reason, which the agent is told.

    Args:
        id (str):
        body (DecideApprovalRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        IssueApproval | Problem
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

) -> Response[IssueApproval | Problem]:
    """ Approve or reject a transition an agent asked for

     For people who may move issues in the project. Approving moves the issue in the agent’s name;
    rejecting needs a reason, which the agent is told.

    Args:
        id (str):
        body (DecideApprovalRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[IssueApproval | Problem]
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

) -> IssueApproval | Problem | None:
    """ Approve or reject a transition an agent asked for

     For people who may move issues in the project. Approving moves the issue in the agent’s name;
    rejecting needs a reason, which the agent is told.

    Args:
        id (str):
        body (DecideApprovalRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        IssueApproval | Problem
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
