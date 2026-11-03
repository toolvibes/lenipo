from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.sprint_approval import SprintApproval
from ...models.sprints_list_approvals_status import SprintsListApprovalsStatus
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    key: str,
    *,
    status: SprintsListApprovalsStatus | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/api/v1/projects/{key}/sprint-approvals".format(key=quote(str(key), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | list[SprintApproval]:
    if response.status_code == 200:
        response_200 = []
        _response_200 = response.json()
        for response_200_item_data in (_response_200):
            response_200_item = SprintApproval.from_dict(response_200_item_data)



            response_200.append(response_200_item)

        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | list[SprintApproval]]:
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
    status: SprintsListApprovalsStatus | Unset = UNSET,

) -> Response[Problem | list[SprintApproval]]:
    """ List the sprint approval requests of agents in a project

    Args:
        key (str):
        status (SprintsListApprovalsStatus | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[SprintApproval]]
     """


    kwargs = _get_kwargs(
        key=key,
status=status,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    status: SprintsListApprovalsStatus | Unset = UNSET,

) -> Problem | list[SprintApproval] | None:
    """ List the sprint approval requests of agents in a project

    Args:
        key (str):
        status (SprintsListApprovalsStatus | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[SprintApproval]
     """


    return sync_detailed(
        key=key,
client=client,
status=status,

    ).parsed

async def asyncio_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    status: SprintsListApprovalsStatus | Unset = UNSET,

) -> Response[Problem | list[SprintApproval]]:
    """ List the sprint approval requests of agents in a project

    Args:
        key (str):
        status (SprintsListApprovalsStatus | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | list[SprintApproval]]
     """


    kwargs = _get_kwargs(
        key=key,
status=status,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    status: SprintsListApprovalsStatus | Unset = UNSET,

) -> Problem | list[SprintApproval] | None:
    """ List the sprint approval requests of agents in a project

    Args:
        key (str):
        status (SprintsListApprovalsStatus | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | list[SprintApproval]
     """


    return (await asyncio_detailed(
        key=key,
client=client,
status=status,

    )).parsed
