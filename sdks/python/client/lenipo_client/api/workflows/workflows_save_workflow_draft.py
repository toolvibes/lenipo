from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.publish_workflow_request_input import PublishWorkflowRequestInput
from ...models.workflow_draft import WorkflowDraft
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: PublishWorkflowRequestInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/api/v1/projects/{key}/workflow/draft".format(key=quote(str(key), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | WorkflowDraft:
    if response.status_code == 200:
        response_200 = WorkflowDraft.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | WorkflowDraft]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: PublishWorkflowRequestInput,

) -> Response[Problem | WorkflowDraft]:
    """ Save the shared draft of a workflow

     Needs project administration. One draft per project and issue type (`issueType`, else the standard
    workflow), shared by its administrators; publishing removes it (TL-77).

    Args:
        key (str):
        body (PublishWorkflowRequestInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | WorkflowDraft]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: PublishWorkflowRequestInput,

) -> Problem | WorkflowDraft | None:
    """ Save the shared draft of a workflow

     Needs project administration. One draft per project and issue type (`issueType`, else the standard
    workflow), shared by its administrators; publishing removes it (TL-77).

    Args:
        key (str):
        body (PublishWorkflowRequestInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | WorkflowDraft
     """


    return sync_detailed(
        key=key,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: PublishWorkflowRequestInput,

) -> Response[Problem | WorkflowDraft]:
    """ Save the shared draft of a workflow

     Needs project administration. One draft per project and issue type (`issueType`, else the standard
    workflow), shared by its administrators; publishing removes it (TL-77).

    Args:
        key (str):
        body (PublishWorkflowRequestInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | WorkflowDraft]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: PublishWorkflowRequestInput,

) -> Problem | WorkflowDraft | None:
    """ Save the shared draft of a workflow

     Needs project administration. One draft per project and issue type (`issueType`, else the standard
    workflow), shared by its administrators; publishing removes it (TL-77).

    Args:
        key (str):
        body (PublishWorkflowRequestInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | WorkflowDraft
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,

    )).parsed
