from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.onboarding_request import OnboardingRequest
from ...models.onboarding_result import OnboardingResult
from ...models.problem import Problem
from typing import cast



def _get_kwargs(
    *,
    body: OnboardingRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/me/onboarding",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> OnboardingResult | Problem:
    if response.status_code == 200:
        response_200 = OnboardingResult.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[OnboardingResult | Problem]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: OnboardingRequest,

) -> Response[OnboardingResult | Problem]:
    """ Finish the welcome steps after the first sign-in

     Saves the profile and, with `start`, creates in one go: Scrum or Kanban → project, board and a
    linked wiki space with a start page; Wiki → only the space. Without `start` the steps count as
    skipped. Web sessions only.

    Args:
        body (OnboardingRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[OnboardingResult | Problem]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: OnboardingRequest,

) -> OnboardingResult | Problem | None:
    """ Finish the welcome steps after the first sign-in

     Saves the profile and, with `start`, creates in one go: Scrum or Kanban → project, board and a
    linked wiki space with a start page; Wiki → only the space. Without `start` the steps count as
    skipped. Web sessions only.

    Args:
        body (OnboardingRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        OnboardingResult | Problem
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: OnboardingRequest,

) -> Response[OnboardingResult | Problem]:
    """ Finish the welcome steps after the first sign-in

     Saves the profile and, with `start`, creates in one go: Scrum or Kanban → project, board and a
    linked wiki space with a start page; Wiki → only the space. Without `start` the steps count as
    skipped. Web sessions only.

    Args:
        body (OnboardingRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[OnboardingResult | Problem]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: OnboardingRequest,

) -> OnboardingResult | Problem | None:
    """ Finish the welcome steps after the first sign-in

     Saves the profile and, with `start`, creates in one go: Scrum or Kanban → project, board and a
    linked wiki space with a start page; Wiki → only the space. Without `start` the steps count as
    skipped. Web sessions only.

    Args:
        body (OnboardingRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        OnboardingResult | Problem
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
